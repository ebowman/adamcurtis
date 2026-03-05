// Shared graph operations

const { distance } = require('./fuzzy');

/**
 * Merge two graphs, deduplicating nodes by fuzzy label matching
 */
function mergeGraphs(base, additions, threshold = 0.85) {
  const merged = JSON.parse(JSON.stringify(base));
  const labelIndex = new Map();
  merged.nodes.forEach(n => labelIndex.set(n.label.toLowerCase(), n.id));

  for (const node of additions.nodes) {
    const match = findBestMatch(node.label, labelIndex, threshold);
    if (match) {
      // Merge episodes and update desc if longer
      const existing = merged.nodes.find(n => n.id === match);
      if (existing) {
        if (node.episodes) {
          existing.episodes = [...new Set([...(existing.episodes || []), ...node.episodes])].sort();
        }
        if (node.desc && (!existing.desc || node.desc.length > existing.desc.length)) {
          existing.desc = node.desc;
        }
      }
    } else {
      merged.nodes.push(node);
      labelIndex.set(node.label.toLowerCase(), node.id);
    }
  }

  // Merge links
  const linkSet = new Set(merged.links.map(l => `${l.source}|${l.target}`));
  for (const link of additions.links) {
    const key = `${link.source}|${link.target}`;
    if (!linkSet.has(key)) {
      merged.links.push(link);
      linkSet.add(key);
    }
  }

  return merged;
}

/**
 * Find best matching label in the index using fuzzy matching
 */
function findBestMatch(label, labelIndex, threshold) {
  const lower = label.toLowerCase();
  if (labelIndex.has(lower)) return labelIndex.get(lower);

  let bestScore = 0;
  let bestId = null;
  for (const [existingLabel, id] of labelIndex) {
    const score = similarity(lower, existingLabel);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

/**
 * Simple string similarity (Dice coefficient on bigrams)
 */
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
  const bigramsB = new Set();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * Generate a URL-safe id from a label
 */
function labelToId(label) {
  return label
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Count connections per node
 */
function connectionCounts(graph) {
  const counts = {};
  graph.links.forEach(l => {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    counts[src] = (counts[src] || 0) + 1;
    counts[tgt] = (counts[tgt] || 0) + 1;
  });
  return counts;
}

/**
 * Find connected components using BFS
 */
function connectedComponents(graph) {
  const adj = {};
  graph.nodes.forEach(n => { adj[n.id] = []; });
  graph.links.forEach(l => {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    if (adj[src]) adj[src].push(tgt);
    if (adj[tgt]) adj[tgt].push(src);
  });

  const visited = new Set();
  const components = [];

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;
    const component = [];
    const queue = [node.id];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(id);
      for (const neighbor of (adj[id] || [])) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    components.push(component);
  }

  return components.sort((a, b) => b.length - a.length);
}

module.exports = {
  mergeGraphs,
  findBestMatch,
  similarity,
  labelToId,
  connectionCounts,
  connectedComponents
};
