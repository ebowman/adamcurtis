// Find weakly connected nodes and suggest missing links

const { loadGraph } = require('../lib/config');
const { connectionCounts, connectedComponents } = require('../lib/graph-utils');

/**
 * Analyze graph for gaps and weak connections
 * @param {string} filePath
 * @returns {object} Analysis results
 */
function analyzeGaps(filePath) {
  const graph = loadGraph(filePath);
  const counts = connectionCounts(graph);
  const components = connectedComponents(graph);

  // Find nodes with few connections
  const weak = graph.nodes
    .map(n => ({ ...n, connections: counts[n.id] || 0 }))
    .filter(n => n.connections <= 1)
    .sort((a, b) => a.connections - b.connections);

  // Find leaf nodes (exactly 1 connection)
  const leaves = weak.filter(n => n.connections === 1);

  // Find isolated nodes (0 connections)
  const isolated = weak.filter(n => n.connections === 0);

  // Find bridge nodes (removing them would disconnect the graph)
  const bridges = findBridges(graph);

  // Type distribution of weak nodes
  const weakByType = {};
  weak.forEach(n => { weakByType[n.type] = (weakByType[n.type] || 0) + 1; });

  // Hub nodes (most connected)
  const hubs = graph.nodes
    .map(n => ({ id: n.id, label: n.label, type: n.type, connections: counts[n.id] || 0 }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 15);

  return {
    components: {
      count: components.length,
      sizes: components.map(c => c.length),
      mainComponentSize: components[0]?.length || 0,
      disconnected: components.length > 1 ? components.slice(1).flat() : []
    },
    weak: {
      total: weak.length,
      isolated: isolated.map(n => ({ id: n.id, label: n.label, type: n.type })),
      leaves: leaves.map(n => ({ id: n.id, label: n.label, type: n.type })),
      byType: weakByType
    },
    bridges: bridges.map(b => ({
      id: b.id,
      label: b.label,
      connections: counts[b.id] || 0
    })),
    hubs,
    totalNodes: graph.nodes.length,
    totalLinks: graph.links.length
  };
}

/**
 * Find bridge nodes (articulation points)
 * Simple approach: for each node, check if removing it increases component count
 */
function findBridges(graph) {
  const baseComponents = connectedComponents(graph).length;
  const bridges = [];

  // Only check well-connected nodes (bridges are usually important)
  const counts = connectionCounts(graph);
  const candidates = graph.nodes.filter(n => (counts[n.id] || 0) >= 3);

  for (const node of candidates) {
    // Create graph without this node
    const reducedGraph = {
      nodes: graph.nodes.filter(n => n.id !== node.id),
      links: graph.links.filter(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        return src !== node.id && tgt !== node.id;
      })
    };
    const reduced = connectedComponents(reducedGraph).length;
    if (reduced > baseComponents) {
      bridges.push(node);
    }
  }

  return bridges;
}

/**
 * Print gap analysis report
 */
function printReport(result) {
  console.log('\n=== Gap Analysis Report ===\n');
  console.log(`Total: ${result.totalNodes} nodes, ${result.totalLinks} links`);
  console.log(`Components: ${result.components.count} (main: ${result.components.mainComponentSize} nodes)`);

  if (result.components.disconnected.length > 0) {
    console.log(`\n⚠ ${result.components.disconnected.length} nodes in disconnected components:`);
    result.components.disconnected.slice(0, 10).forEach(id => console.log(`  - ${id}`));
  }

  if (result.weak.isolated.length > 0) {
    console.log(`\n✗ ${result.weak.isolated.length} isolated nodes (0 connections):`);
    result.weak.isolated.forEach(n => console.log(`  - ${n.label} [${n.type}]`));
  }

  if (result.weak.leaves.length > 0) {
    console.log(`\n⚠ ${result.weak.leaves.length} leaf nodes (1 connection):`);
    result.weak.leaves.forEach(n => console.log(`  - ${n.label} [${n.type}]`));
  }

  if (result.bridges.length > 0) {
    console.log(`\n🔗 ${result.bridges.length} bridge nodes (removing them disconnects the graph):`);
    result.bridges.forEach(n => console.log(`  - ${n.label} (${n.connections} connections)`));
  }

  console.log('\n📊 Top 15 most connected (hubs):');
  result.hubs.forEach((n, i) =>
    console.log(`  ${(i + 1).toString().padStart(2)}. ${n.label} [${n.type}] — ${n.connections} connections`)
  );

  console.log('');
}

module.exports = { analyzeGaps, printReport };
