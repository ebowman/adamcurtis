// Generate self-contained HTML visualization from graph.json

const fs = require('fs');
const path = require('path');
const { loadGraph } = require('../lib/config');

/**
 * Generate an HTML mindmap from a graph.json file
 * @param {string} graphPath - Path to graph.json
 * @param {string} outputPath - Path for output HTML
 * @param {object} opts - { template }
 */
function visualize(graphPath, outputPath, opts = {}) {
  const graph = loadGraph(graphPath);
  const templatePath = opts.template || path.join(__dirname, 'template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  const title = graph.meta?.title || 'Knowledge Graph';
  const dataJson = JSON.stringify(graph);

  const html = template
    .replace(/\{\{TITLE\}\}/g, escapeHtml(title))
    .replace('{{DATA}}', dataJson);

  fs.writeFileSync(outputPath, html);
  console.log(`Generated ${outputPath} (${graph.nodes.length} nodes, ${graph.links.length} links)`);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { visualize };
