// Compare two graph.json files

const { loadGraph } = require('../lib/config');
const { similarity } = require('../lib/graph-utils');

/**
 * Compare two graphs and report differences
 * @param {string} fileA - Path to first graph
 * @param {string} fileB - Path to second graph
 * @returns {object} Comparison results
 */
function compareGraphs(fileA, fileB) {
  const graphA = loadGraph(fileA);
  const graphB = loadGraph(fileB);

  // Build label maps
  const labelsA = new Map(graphA.nodes.map(n => [n.label.toLowerCase(), n]));
  const labelsB = new Map(graphB.nodes.map(n => [n.label.toLowerCase(), n]));

  // Find matching, unique-to-A, unique-to-B nodes
  const matched = [];
  const uniqueA = [];
  const uniqueB = new Map(labelsB);

  for (const [key, nodeA] of labelsA) {
    const exact = labelsB.get(key);
    if (exact) {
      matched.push({ a: nodeA, b: exact });
      uniqueB.delete(key);
      continue;
    }
    // Fuzzy match
    let found = false;
    for (const [keyB, nodeB] of uniqueB) {
      if (similarity(key, keyB) > 0.85) {
        matched.push({ a: nodeA, b: nodeB });
        uniqueB.delete(keyB);
        found = true;
        break;
      }
    }
    if (!found) uniqueA.push(nodeA);
  }

  // Link comparison
  const linksA = new Set(graphA.links.map(l => `${l.source}|${l.target}`));
  const linksB = new Set(graphB.links.map(l => `${l.source}|${l.target}`));
  const commonLinks = [...linksA].filter(l => linksB.has(l));
  const onlyInA = [...linksA].filter(l => !linksB.has(l));
  const onlyInB = [...linksB].filter(l => !linksA.has(l));

  // Type distribution comparison
  const typesA = {};
  graphA.nodes.forEach(n => { typesA[n.type] = (typesA[n.type] || 0) + 1; });
  const typesB = {};
  graphB.nodes.forEach(n => { typesB[n.type] = (typesB[n.type] || 0) + 1; });

  return {
    fileA: { path: fileA, nodes: graphA.nodes.length, links: graphA.links.length, types: typesA },
    fileB: { path: fileB, nodes: graphB.nodes.length, links: graphB.links.length, types: typesB },
    matched: matched.length,
    uniqueToA: uniqueA.map(n => ({ label: n.label, type: n.type })),
    uniqueToB: [...uniqueB.values()].map(n => ({ label: n.label, type: n.type })),
    links: {
      commonLinks: commonLinks.length,
      onlyInA: onlyInA.length,
      onlyInB: onlyInB.length
    }
  };
}

/**
 * Print comparison report
 */
function printReport(result) {
  const a = result.fileA;
  const b = result.fileB;

  console.log('\n=== Graph Comparison ===\n');
  console.log(`  File A: ${a.path}`);
  console.log(`    ${a.nodes} nodes, ${a.links} links`);
  console.log(`    Types: ${Object.entries(a.types).map(([t, c]) => `${t}: ${c}`).join(', ')}`);
  console.log(`  File B: ${b.path}`);
  console.log(`    ${b.nodes} nodes, ${b.links} links`);
  console.log(`    Types: ${Object.entries(b.types).map(([t, c]) => `${t}: ${c}`).join(', ')}`);

  console.log(`\n  Matched nodes: ${result.matched}`);
  console.log(`  Unique to A: ${result.uniqueToA.length}`);
  console.log(`  Unique to B: ${result.uniqueToB.length}`);

  if (result.uniqueToA.length > 0) {
    console.log(`\n  Only in A:`);
    result.uniqueToA.slice(0, 20).forEach(n =>
      console.log(`    - ${n.label} [${n.type}]`)
    );
    if (result.uniqueToA.length > 20) console.log(`    ... and ${result.uniqueToA.length - 20} more`);
  }

  if (result.uniqueToB.length > 0) {
    console.log(`\n  Only in B:`);
    result.uniqueToB.slice(0, 20).forEach(n =>
      console.log(`    - ${n.label} [${n.type}]`)
    );
    if (result.uniqueToB.length > 20) console.log(`    ... and ${result.uniqueToB.length - 20} more`);
  }

  console.log(`\n  Links: ${result.links.commonLinks} common, ${result.links.onlyInA} only in A, ${result.links.onlyInB} only in B`);
  console.log('');
}

module.exports = { compareGraphs, printReport };
