// Claude API extraction using @anthropic-ai/sdk with structured output via tool_use

const fs = require('fs');
const path = require('path');
const { labelToId, similarity } = require('./graph-utils');
const { DEFAULT_TYPES, DEFAULT_CHUNK_SIZE } = require('./config');

// Load .env if present (no external dependency)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

/**
 * Extract entities and relationships from text chunks using Claude
 * @param {Array<{text: string, source: string}>} chunks
 * @param {object} opts - { apiKey, model, types, concurrency }
 * @returns {Promise<{nodes: Array, links: Array}>}
 */
async function extractWithLLM(chunks, opts = {}) {
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    throw new Error(
      'Claude API extraction requires @anthropic-ai/sdk.\n' +
      'Install it: npm install @anthropic-ai/sdk\n' +
      'Set ANTHROPIC_API_KEY in your environment.'
    );
  }

  const client = new Anthropic({ apiKey: opts.apiKey || process.env.ANTHROPIC_API_KEY });
  const model = opts.model || 'claude-sonnet-4-20250514';
  const types = opts.types || DEFAULT_TYPES;
  const concurrency = opts.concurrency || 3;
  const customSystemPrompt = opts.systemPrompt || null;

  const typeList = Object.entries(types).map(([k, v]) => `${k} (${v.label})`).join(', ');

  const tool = {
    name: 'extract_knowledge_graph',
    description: 'Extract entities and relationships from the text to build a knowledge graph',
    input_schema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Entity name' },
              type: { type: 'string', enum: Object.keys(types), description: 'Entity type' },
              desc: { type: 'string', description: 'Brief description (1-2 sentences)' }
            },
            required: ['label', 'type', 'desc']
          }
        },
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Source entity label' },
              target: { type: 'string', description: 'Target entity label' },
              label: { type: 'string', description: 'Short relationship description (2-4 words)' }
            },
            required: ['source', 'target', 'label']
          }
        }
      },
      required: ['nodes', 'links']
    }
  };

  // Process chunks with concurrency limit
  const allResults = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const progress = Math.min(i + concurrency, chunks.length);
    process.stderr.write(`\r  Extracting chunk ${progress}/${chunks.length}...`);

    const results = await Promise.all(batch.map(chunk =>
      extractChunk(client, model, chunk, tool, typeList, customSystemPrompt)
    ));
    allResults.push(...results.filter(Boolean));
  }
  process.stderr.write('\n');

  // Merge and deduplicate across all chunks
  return deduplicateResults(allResults);
}

/**
 * Extract from a single chunk
 */
async function extractChunk(client, model, chunk, tool, typeList, customSystemPrompt) {
  const systemPrompt = customSystemPrompt
    ? `${customSystemPrompt} Entity types: ${typeList}.`
    : `You are a knowledge graph extraction expert. Extract ALL named entities (people, events, ideas, places, works) and their relationships from the given text. Be thorough — don't miss obscure references. Entity types: ${typeList}.`;

  const userPrompt = `Extract all entities and relationships from this text:\n\n---\nSource: ${chunk.source}\n${chunk.timestamp ? `Time: ${chunk.timestamp}\n` : ''}---\n\n${chunk.text}`;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'extract_knowledge_graph' },
      messages: [{ role: 'user', content: userPrompt }]
    });

    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (toolUse) {
      return {
        nodes: toolUse.input.nodes || [],
        links: toolUse.input.links || [],
        source: chunk.source
      };
    }
  } catch (err) {
    process.stderr.write(`\n  Warning: chunk extraction failed: ${err.message}\n`);
  }
  return null;
}

/**
 * Deduplicate nodes and links across chunks
 */
function deduplicateResults(results) {
  const nodeMap = new Map(); // lowercase label -> node
  const allLinks = [];

  for (const result of results) {
    for (const node of result.nodes) {
      const key = node.label.toLowerCase();
      const existing = findSimilarNode(key, nodeMap);
      if (existing) {
        // Merge: keep longer desc
        const ex = nodeMap.get(existing);
        if (node.desc && node.desc.length > (ex.desc || '').length) {
          ex.desc = node.desc;
        }
        if (!ex.sources) ex.sources = [];
        ex.sources.push(result.source);
      } else {
        nodeMap.set(key, {
          ...node,
          id: labelToId(node.label),
          sources: [result.source]
        });
      }
    }

    for (const link of result.links) {
      allLinks.push({ ...link, _source: result.source });
    }
  }

  const nodes = [...nodeMap.values()];
  const nodeLabels = new Map(nodes.map(n => [n.label.toLowerCase(), n.id]));

  // Resolve link labels to node ids
  const links = [];
  const linkSet = new Set();
  for (const link of allLinks) {
    const srcId = resolveLabel(link.source, nodeLabels);
    const tgtId = resolveLabel(link.target, nodeLabels);
    if (!srcId || !tgtId || srcId === tgtId) continue;

    const key = `${srcId}|${tgtId}`;
    if (linkSet.has(key)) continue;
    linkSet.add(key);
    links.push({ source: srcId, target: tgtId, label: link.label });
  }

  return { nodes, links };
}

function findSimilarNode(label, nodeMap) {
  if (nodeMap.has(label)) return label;
  for (const key of nodeMap.keys()) {
    if (similarity(label, key) > 0.85) return key;
  }
  return null;
}

function resolveLabel(label, nodeLabels) {
  const lower = label.toLowerCase();
  if (nodeLabels.has(lower)) return nodeLabels.get(lower);
  // Fuzzy match
  for (const [key, id] of nodeLabels) {
    if (similarity(lower, key) > 0.8) return id;
  }
  return null;
}

module.exports = { extractWithLLM };
