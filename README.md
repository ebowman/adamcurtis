# Adam Curtis Mind Map & subtitle-graph

Interactive knowledge graph of **Can't Get You Out of My Head** (Adam Curtis, BBC, 2021) — and a reusable CLI tool for turning any subtitles or transcripts into interactive mind maps.

**[View the Mind Map →](https://ebowman.github.io/adamcurtis/)** (209 nodes, 375 links)

## The Documentary

*Can't Get You Out of My Head: An Emotional History of the Modern World* is a six-part BBC documentary that traces hidden connections between power, individualism, and conspiracy from the Victorian era to the present. The mind map captures people, events, ideas, places, and works mentioned across all six episodes and their relationships.

## The Tool: subtitle-graph

A Node.js CLI that takes subtitle files (.srt, .vtt) or transcripts (.md, .txt) and generates interactive HTML knowledge graphs.

### Quick Start

```bash
# Install
npm install

# Extract entities from subtitles (regex — free, fast)
node cli.js extract ./subs/*.srt -o graph.json --title "My Documentary"

# Extract with Claude API (better quality, costs ~$0.05-0.10/episode)
ANTHROPIC_API_KEY=sk-... node cli.js extract ./subs/*.srt -e claude -o graph.json

# Validate the graph
node cli.js validate graph.json

# Find gaps and weak connections
node cli.js gaps graph.json

# Generate interactive HTML
node cli.js visualize graph.json -o mindmap.html

# Compare two extractions
node cli.js compare graph-regex.json graph-claude.json
```

### Commands

| Command | Description |
|---------|-------------|
| `extract <files...>` | Extract entities and relationships from subtitle/text files |
| `validate <file>` | Check graph.json for integrity issues (dangling links, duplicates) |
| `gaps <file>` | Find weakly connected nodes, bridges, hubs, disconnected components |
| `visualize <file>` | Generate self-contained interactive HTML mindmap |
| `compare <a> <b>` | Diff two graph.json files — show unique/shared nodes and links |

### Extract Options

```
-e, --engine <engine>   regex (default) or claude
-o, --output <path>     Output path (default: graph.json)
-t, --title <title>     Graph title
-s, --source <source>   Source attribution
--min-frequency <n>     Min entity mentions for regex engine (default: 2)
--model <model>         Claude model (default: claude-sonnet-4-20250514)
--concurrency <n>       Concurrent API calls (default: 3)
```

### Pipeline

```
Subtitles (.srt/.vtt/.md/.txt)
    ↓
Parse → Text chunks with timestamps
    ↓
Extract → Entities + relationships (regex or Claude API)
    ↓
Merge → Deduplicate entities (fuzzy matching)
    ↓
Validate → Check integrity
    ↓
Gaps → Find weak connections
    ↓
Visualize → Interactive HTML (D3.js force-directed graph)
```

### Graph Data Format

```json
{
  "meta": { "title": "...", "source": "...", "generated": "2026-03-05" },
  "types": {
    "person": { "color": "#4a8fe7", "label": "Person" },
    "event":  { "color": "#e8943a", "label": "Event" },
    "idea":   { "color": "#5cb85c", "label": "Idea/Theory" },
    "place":  { "color": "#d9534f", "label": "Place" },
    "work":   { "color": "#9b59b6", "label": "Work/Creation" }
  },
  "nodes": [
    { "id": "george_boole", "label": "George Boole", "type": "person", "desc": "..." }
  ],
  "links": [
    { "source": "george_boole", "target": "boolean_logic", "label": "invented" }
  ]
}
```

## Project Structure

```
├── index.html                    # The Adam Curtis mind map (self-contained)
├── cli.js                        # CLI entry point
├── Cant-Get-You-Out-of-My-Head-Facts-and-Connections.md
│
├── tools/                        # CLI commands
│   ├── extract.js                # Entity + relationship extraction
│   ├── validate.js               # Graph integrity checking
│   ├── gaps.js                   # Weak connection analysis
│   ├── visualize.js              # HTML generation
│   ├── compare.js                # Graph diff
│   └── template.html             # D3 visualization template
│
├── lib/                          # Shared libraries
│   ├── parse-subtitles.js        # SRT/VTT/text → chunks
│   ├── extract-entities.js       # Regex extraction engine
│   ├── extract-llm.js            # Claude API extraction engine
│   ├── graph-utils.js            # Merge, deduplicate, components
│   ├── fuzzy.js                  # String similarity
│   ├── glob-simple.js            # File glob matching
│   └── config.js                 # Types, defaults, graph I/O
│
└── data/                         # Extracted graph data
    └── adam-curtis.json           # The 209-node hand-curated graph
```

## Extraction Engines

### Regex (default)
Free, fast, runs locally. Finds capitalized multi-word phrases and counts frequency. Good for a first pass but misses context — "Wolf Mountain" gets typed as a person, not a place. Best when combined with manual curation.

### Claude API
Sends text chunks to Claude with structured output (tool_use). Understands context — correctly types entities and generates meaningful relationship labels. Costs ~$0.05-0.10 per episode depending on length and model. Requires `ANTHROPIC_API_KEY`.

## The Journey

This project started as a hand-curated mind map built through 5+ manual passes over transcripts. We used regex extraction, frequency counting, and careful reading to identify 209 nodes and 375 links. Along the way we discovered that major entities (OxyContin, Trump, Oswald, the Illuminati) were missed until late passes — motivating the tool approach.

The `subtitle-graph` CLI generalizes this process so it can be applied to any documentary, lecture series, or text corpus.

## License

MIT
