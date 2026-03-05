// Entity + relationship extraction (dispatches to engine)

const { parseFiles } = require('../lib/parse-subtitles');
const { extractEntities } = require('../lib/extract-entities');
const { createEmptyGraph, saveGraph } = require('../lib/config');

/**
 * Run extraction pipeline
 * @param {string[]} inputFiles - Paths to subtitle/text files
 * @param {object} opts - { engine, output, title, source, minFrequency, ... }
 */
async function extract(inputFiles, opts = {}) {
  const engine = opts.engine || 'regex';

  console.log(`Parsing ${inputFiles.length} files...`);
  const chunks = parseFiles(inputFiles, {
    chunkSize: opts.chunkSize || 3000,
    chunkOverlap: opts.chunkOverlap || 200
  });
  console.log(`  ${chunks.length} chunks extracted`);

  let result;
  switch (engine) {
    case 'regex':
      console.log('Extracting with regex engine...');
      result = extractEntities(chunks, {
        minFrequency: opts.minFrequency || 2,
        customEntities: opts.customEntities
      });
      break;

    case 'claude':
    case 'llm':
      console.log('Extracting with Claude API...');
      const { extractWithLLM } = require('../lib/extract-llm');
      result = await extractWithLLM(chunks, {
        model: opts.model,
        concurrency: opts.concurrency || 3,
        types: opts.types,
        systemPrompt: opts.systemPrompt
      });
      break;

    default:
      throw new Error(`Unknown engine: ${engine}. Use 'regex' or 'claude'.`);
  }

  console.log(`  ${result.nodes.length} entities, ${result.links.length} relationships`);

  // Build graph
  const graph = createEmptyGraph({
    title: opts.title || 'Extracted Knowledge Graph',
    source: opts.source || inputFiles.map(f => require('path').basename(f)).join(', '),
    engine
  });
  graph.nodes = result.nodes;
  graph.links = result.links;

  if (opts.output) {
    saveGraph(graph, opts.output);
    console.log(`Saved to ${opts.output}`);
  }

  return graph;
}

module.exports = { extract };
