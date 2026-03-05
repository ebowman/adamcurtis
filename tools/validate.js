// Validate graph.json integrity

const { loadGraph } = require('../lib/config');

/**
 * Validate a graph file and report issues
 * @param {string} filePath
 * @returns {{valid: boolean, errors: string[], warnings: string[], stats: object}}
 */
function validate(filePath) {
  const graph = loadGraph(filePath);
  const errors = [];
  const warnings = [];

  const nodeIds = new Set(graph.nodes.map(n => n.id));
  const nodeLabels = graph.nodes.map(n => n.label);

  // Check for duplicate node IDs
  const idCounts = {};
  graph.nodes.forEach(n => { idCounts[n.id] = (idCounts[n.id] || 0) + 1; });
  for (const [id, count] of Object.entries(idCounts)) {
    if (count > 1) errors.push(`Duplicate node ID: "${id}" appears ${count} times`);
  }

  // Check for duplicate labels
  const labelCounts = {};
  graph.nodes.forEach(n => { labelCounts[n.label.toLowerCase()] = (labelCounts[n.label.toLowerCase()] || 0) + 1; });
  for (const [label, count] of Object.entries(labelCounts)) {
    if (count > 1) warnings.push(`Duplicate label: "${label}" appears ${count} times`);
  }

  // Check for dangling links
  let danglingCount = 0;
  for (const link of graph.links) {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    if (!nodeIds.has(src)) {
      errors.push(`Dangling link source: "${src}" not found in nodes`);
      danglingCount++;
    }
    if (!nodeIds.has(tgt)) {
      errors.push(`Dangling link target: "${tgt}" not found in nodes`);
      danglingCount++;
    }
  }

  // Check for self-links
  for (const link of graph.links) {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    if (src === tgt) warnings.push(`Self-link: "${src}" → "${src}" (${link.label})`);
  }

  // Check for duplicate links
  const linkKeys = new Set();
  for (const link of graph.links) {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    const key = `${src}|${tgt}`;
    if (linkKeys.has(key)) warnings.push(`Duplicate link: "${src}" → "${tgt}"`);
    linkKeys.add(key);
  }

  // Check for nodes without type
  graph.nodes.forEach(n => {
    if (!n.type) warnings.push(`Node "${n.label}" has no type`);
    if (!n.desc) warnings.push(`Node "${n.label}" has no description`);
  });

  // Check for unknown types
  const validTypes = graph.types ? new Set(Object.keys(graph.types)) : null;
  if (validTypes) {
    graph.nodes.forEach(n => {
      if (n.type && !validTypes.has(n.type)) {
        warnings.push(`Node "${n.label}" has unknown type "${n.type}"`);
      }
    });
  }

  // Stats
  const typeCounts = {};
  graph.nodes.forEach(n => { typeCounts[n.type] = (typeCounts[n.type] || 0) + 1; });

  const connCounts = {};
  graph.links.forEach(l => {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    connCounts[src] = (connCounts[src] || 0) + 1;
    connCounts[tgt] = (connCounts[tgt] || 0) + 1;
  });
  const disconnected = graph.nodes.filter(n => !connCounts[n.id]).map(n => n.label);

  const stats = {
    nodes: graph.nodes.length,
    links: graph.links.length,
    types: typeCounts,
    disconnectedNodes: disconnected.length,
    avgConnections: graph.nodes.length > 0
      ? (Object.values(connCounts).reduce((a, b) => a + b, 0) / graph.nodes.length).toFixed(1)
      : 0
  };

  if (disconnected.length > 0) {
    warnings.push(`${disconnected.length} disconnected nodes: ${disconnected.slice(0, 5).join(', ')}${disconnected.length > 5 ? '...' : ''}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats
  };
}

/**
 * Print validation report to console
 */
function printReport(result) {
  console.log('\n=== Graph Validation Report ===\n');
  console.log(`Status: ${result.valid ? '✓ VALID' : '✗ INVALID'}`);
  console.log(`Nodes: ${result.stats.nodes}  Links: ${result.stats.links}  Avg connections: ${result.stats.avgConnections}`);
  console.log('Types:', Object.entries(result.stats.types).map(([t, c]) => `${t}: ${c}`).join(', '));

  if (result.errors.length > 0) {
    console.log(`\n✗ ${result.errors.length} errors:`);
    result.errors.forEach(e => console.log(`  - ${e}`));
  }
  if (result.warnings.length > 0) {
    console.log(`\n⚠ ${result.warnings.length} warnings:`);
    result.warnings.forEach(w => console.log(`  - ${w}`));
  }
  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log('\nNo issues found.');
  }
  console.log('');
}

module.exports = { validate, printReport };
