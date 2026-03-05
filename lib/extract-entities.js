// Regex-based entity extraction with configurable patterns

const { DEFAULT_PATTERNS } = require('./config');
const { labelToId, similarity } = require('./graph-utils');

/**
 * Extract entities from text chunks using regex patterns
 * @param {Array<{text: string, source: string}>} chunks
 * @param {object} opts - { patterns, minFrequency, customEntities }
 * @returns {{nodes: Array, links: Array}}
 */
function extractEntities(chunks, opts = {}) {
  const patterns = opts.patterns || DEFAULT_PATTERNS;
  const minFrequency = opts.minFrequency || 2;
  const customEntities = opts.customEntities || {};

  // Phase 1: Find all candidate entities and their contexts
  const candidates = new Map(); // label -> { type, count, contexts: [], sources: Set }

  for (const chunk of chunks) {
    const text = chunk.text;

    // Apply regex patterns for each type
    for (const [type, config] of Object.entries(patterns)) {
      const stopwords = new Set((config.stopwords || []).map(s => s.toLowerCase()));

      for (const pattern of config.patterns) {
        // Reset regex state
        const re = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = re.exec(text)) !== null) {
          const label = match[1]?.trim();
          if (!label || label.length < 2 || stopwords.has(label.toLowerCase())) continue;

          const key = label.toLowerCase();
          if (!candidates.has(key)) {
            candidates.set(key, {
              label,
              type,
              count: 0,
              contexts: [],
              sources: new Set()
            });
          }
          const entry = candidates.get(key);
          entry.count++;
          entry.sources.add(chunk.source);
          // Capture surrounding context (±100 chars)
          const start = Math.max(0, match.index - 100);
          const end = Math.min(text.length, match.index + match[0].length + 100);
          if (entry.contexts.length < 5) {
            entry.contexts.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
          }
        }
      }
    }

    // Also look for custom entities (pre-defined lists)
    for (const [type, entities] of Object.entries(customEntities)) {
      for (const entity of entities) {
        const re = new RegExp(`\\b${escapeRegex(entity)}\\b`, 'gi');
        let match;
        while ((match = re.exec(text)) !== null) {
          const key = entity.toLowerCase();
          if (!candidates.has(key)) {
            candidates.set(key, {
              label: entity,
              type,
              count: 0,
              contexts: [],
              sources: new Set()
            });
          }
          const entry = candidates.get(key);
          entry.count++;
          entry.sources.add(chunk.source);
        }
      }
    }
  }

  // Phase 2: Filter by frequency and deduplicate
  const filtered = [];
  const seen = new Set();

  for (const [key, entry] of candidates) {
    if (entry.count < minFrequency) continue;
    // Check for near-duplicates
    let isDuplicate = false;
    for (const existing of filtered) {
      if (similarity(key, existing.label.toLowerCase()) > 0.85) {
        // Keep the one with higher count
        if (entry.count > existing.count) {
          filtered.splice(filtered.indexOf(existing), 1);
          break;
        } else {
          isDuplicate = true;
          break;
        }
      }
    }
    if (!isDuplicate) {
      filtered.push(entry);
    }
  }

  // Phase 3: Build nodes
  const nodes = filtered.map(entry => ({
    id: labelToId(entry.label),
    label: entry.label,
    type: entry.type,
    desc: generateDescription(entry),
    mentions: entry.count,
    sources: [...entry.sources]
  }));

  // Phase 4: Infer links from co-occurrence
  const links = inferLinks(chunks, nodes);

  return { nodes, links };
}

/**
 * Generate a description from context snippets
 */
function generateDescription(entry) {
  if (entry.contexts.length === 0) return '';
  // Pick the longest context as the description
  const best = entry.contexts.reduce((a, b) => a.length > b.length ? a : b);
  return `Mentioned ${entry.count} times. Context: "${best.slice(0, 200)}..."`;
}

/**
 * Infer relationships from co-occurrence within chunks
 */
function inferLinks(chunks, nodes) {
  const links = [];
  const linkSet = new Set();
  const nodeIds = new Set(nodes.map(n => n.id));

  for (const chunk of chunks) {
    const text = chunk.text.toLowerCase();
    const present = nodes.filter(n =>
      text.includes(n.label.toLowerCase())
    );

    // Create links between all co-occurring entities in this chunk
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const key = [present[i].id, present[j].id].sort().join('|');
        if (linkSet.has(key)) continue;
        linkSet.add(key);
        links.push({
          source: present[i].id,
          target: present[j].id,
          label: 'co-mentioned'
        });
      }
    }
  }

  return links;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { extractEntities };
