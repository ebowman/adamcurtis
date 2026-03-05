// Default configuration for subtitle-graph

const DEFAULT_TYPES = {
  person: { color: '#4a8fe7', label: 'Person' },
  event:  { color: '#e8943a', label: 'Event' },
  idea:   { color: '#5cb85c', label: 'Idea/Theory' },
  place:  { color: '#d9534f', label: 'Place' },
  work:   { color: '#9b59b6', label: 'Work/Creation' }
};

const DEFAULT_CHUNK_SIZE = 3000; // characters per chunk for LLM extraction
const DEFAULT_CHUNK_OVERLAP = 200;

// Regex patterns for entity extraction (defaults)
const DEFAULT_PATTERNS = {
  person: {
    // Capitalized two+ word names (First Last, First Middle Last)
    patterns: [
      /\b([A-Z][a-z]+(?:\s+(?:de|von|van|al-|bin|ibn|el-)?\s*)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g
    ],
    // Words that look like names but aren't
    stopwords: [
      'The End', 'Part One', 'Part Two', 'Part Three', 'Part Four', 'Part Five', 'Part Six',
      'New York', 'United States', 'United Kingdom', 'Soviet Union', 'Hong Kong',
      'World War', 'Cold War', 'Middle East', 'North Korea', 'South Korea',
      'Black Power', 'Red Army', 'White House'
    ]
  },
  place: {
    patterns: [
      /\b(?:in|at|from|to|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
    ],
    stopwords: []
  },
  event: {
    patterns: [
      /\b((?:the\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:of|in)\s+\d{4})\b/g,
      /\b(\d{4}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
    ],
    stopwords: []
  }
};

function createEmptyGraph(meta = {}) {
  return {
    meta: {
      title: meta.title || 'Untitled',
      source: meta.source || '',
      generated: new Date().toISOString().split('T')[0],
      ...meta
    },
    types: { ...DEFAULT_TYPES },
    nodes: [],
    links: []
  };
}

function loadGraph(filePath) {
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // Validate basic structure
  if (!data.nodes || !data.links) {
    throw new Error(`Invalid graph file: missing nodes or links array`);
  }
  if (!data.types) data.types = { ...DEFAULT_TYPES };
  if (!data.meta) data.meta = {};
  return data;
}

function saveGraph(graph, filePath) {
  const fs = require('fs');
  fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
}

module.exports = {
  DEFAULT_TYPES,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_PATTERNS,
  createEmptyGraph,
  loadGraph,
  saveGraph
};
