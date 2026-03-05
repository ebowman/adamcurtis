#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const { glob } = require('./lib/glob-simple');

const program = new Command();

program
  .name('subtitle-graph')
  .description('Transform subtitles and transcripts into interactive knowledge graphs')
  .version('0.1.0');

// --- EXTRACT ---
program
  .command('extract')
  .description('Extract entities and relationships from subtitle/text files')
  .argument('<files...>', 'Input files (.srt, .vtt, .md, .txt) — supports globs')
  .option('-e, --engine <engine>', 'Extraction engine: regex or claude', 'regex')
  .option('-o, --output <path>', 'Output graph.json path', 'graph.json')
  .option('-t, --title <title>', 'Graph title')
  .option('-s, --source <source>', 'Source attribution')
  .option('--min-frequency <n>', 'Min entity mentions (regex)', '2')
  .option('--model <model>', 'Claude model (for claude engine)')
  .option('--concurrency <n>', 'Concurrent API calls (for claude engine)', '3')
  .action(async (files, opts) => {
    const { extract } = require('./tools/extract');
    const resolved = resolveGlobs(files);
    if (resolved.length === 0) {
      console.error('No files matched the input patterns');
      process.exit(1);
    }
    await extract(resolved, {
      engine: opts.engine,
      output: opts.output,
      title: opts.title,
      source: opts.source,
      minFrequency: parseInt(opts.minFrequency),
      model: opts.model,
      concurrency: parseInt(opts.concurrency)
    });
  });

// --- VALIDATE ---
program
  .command('validate')
  .description('Check graph.json for integrity issues')
  .argument('<file>', 'Path to graph.json')
  .action((file) => {
    const { validate, printReport } = require('./tools/validate');
    const result = validate(file);
    printReport(result);
    process.exit(result.valid ? 0 : 1);
  });

// --- GAPS ---
program
  .command('gaps')
  .description('Find weakly connected nodes and suggest improvements')
  .argument('<file>', 'Path to graph.json')
  .action((file) => {
    const { analyzeGaps, printReport } = require('./tools/gaps');
    const result = analyzeGaps(file);
    printReport(result);
  });

// --- VISUALIZE ---
program
  .command('visualize')
  .description('Generate interactive HTML mindmap from graph.json')
  .argument('<file>', 'Path to graph.json')
  .option('-o, --output <path>', 'Output HTML path', 'mindmap.html')
  .option('--template <path>', 'Custom HTML template')
  .action((file, opts) => {
    const { visualize } = require('./tools/visualize');
    visualize(file, opts.output, { template: opts.template });
  });

// --- COMPARE ---
program
  .command('compare')
  .description('Compare two graph.json files')
  .argument('<fileA>', 'First graph.json')
  .argument('<fileB>', 'Second graph.json')
  .action((fileA, fileB) => {
    const { compareGraphs, printReport } = require('./tools/compare');
    const result = compareGraphs(fileA, fileB);
    printReport(result);
  });

program.parse();

/**
 * Resolve glob patterns in file arguments
 */
function resolveGlobs(patterns) {
  const fs = require('fs');
  const files = [];
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      files.push(...glob(pattern));
    } else if (fs.existsSync(pattern)) {
      files.push(path.resolve(pattern));
    } else {
      console.error(`Warning: file not found: ${pattern}`);
    }
  }
  return [...new Set(files)];
}
