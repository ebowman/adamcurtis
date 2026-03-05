// Parse SRT, VTT, and plain text/markdown into text chunks

const fs = require('fs');
const path = require('path');

/**
 * Parse a subtitle or text file into chunks
 * @param {string} filePath - Path to .srt, .vtt, or .md/.txt file
 * @param {object} opts - { chunkSize: number, chunkOverlap: number }
 * @returns {Array<{text: string, timestamp?: string, source: string, index: number}>}
 */
function parseFile(filePath, opts = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf8');
  const source = path.basename(filePath);

  switch (ext) {
    case '.srt': return parseSRT(content, source, opts);
    case '.vtt': return parseVTT(content, source, opts);
    case '.md':
    case '.txt': return parseText(content, source, opts);
    default:
      throw new Error(`Unsupported file type: ${ext} (supported: .srt, .vtt, .md, .txt)`);
  }
}

/**
 * Parse SRT subtitle format
 */
function parseSRT(content, source, opts = {}) {
  const chunkSize = opts.chunkSize || 3000;
  const blocks = content.split(/\n\s*\n/).filter(b => b.trim());
  const cues = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    // SRT: index, timestamp, text (one or more lines)
    if (lines.length < 3) continue;
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const timeIndex = lines.indexOf(timeLine);
    const text = lines.slice(timeIndex + 1).join(' ')
      .replace(/<[^>]+>/g, '')  // strip HTML tags
      .replace(/\{[^}]+\}/g, '')  // strip formatting tags
      .trim();
    if (text) {
      cues.push({ timestamp: timeLine.trim(), text });
    }
  }

  return chunkCues(cues, source, chunkSize);
}

/**
 * Parse WebVTT subtitle format
 */
function parseVTT(content, source, opts = {}) {
  const chunkSize = opts.chunkSize || 3000;
  // Remove WEBVTT header
  const body = content.replace(/^WEBVTT[^\n]*\n/, '').replace(/^NOTE[^\n]*\n(?:[^\n]+\n)*/gm, '');
  const blocks = body.split(/\n\s*\n/).filter(b => b.trim());
  const cues = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const timeIndex = lines.indexOf(timeLine);
    const text = lines.slice(timeIndex + 1).join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (text) {
      cues.push({ timestamp: timeLine.trim(), text });
    }
  }

  return chunkCues(cues, source, chunkSize);
}

/**
 * Parse plain text / markdown into chunks by section or by size
 */
function parseText(content, source, opts = {}) {
  const chunkSize = opts.chunkSize || 3000;

  // Try splitting on markdown headings first
  const sections = content.split(/^#{1,3}\s+/m).filter(s => s.trim());

  if (sections.length > 1) {
    return sections.map((section, i) => {
      const firstLine = section.split('\n')[0].trim();
      return {
        text: section.trim(),
        source,
        index: i,
        heading: firstLine.length < 120 ? firstLine : undefined
      };
    });
  }

  // Fall back to size-based chunking
  return chunkText(content, source, chunkSize, opts.chunkOverlap || 200);
}

/**
 * Group subtitle cues into chunks of approximately chunkSize characters
 */
function chunkCues(cues, source, chunkSize) {
  const chunks = [];
  let current = { texts: [], startTime: null, endTime: null };
  let currentLen = 0;

  for (const cue of cues) {
    if (!current.startTime) current.startTime = cue.timestamp;
    current.texts.push(cue.text);
    current.endTime = cue.timestamp;
    currentLen += cue.text.length;

    if (currentLen >= chunkSize) {
      chunks.push({
        text: current.texts.join(' '),
        timestamp: `${extractTime(current.startTime)} → ${extractTime(current.endTime)}`,
        source,
        index: chunks.length
      });
      current = { texts: [], startTime: null, endTime: null };
      currentLen = 0;
    }
  }

  if (current.texts.length > 0) {
    chunks.push({
      text: current.texts.join(' '),
      timestamp: `${extractTime(current.startTime)} → ${extractTime(current.endTime)}`,
      source,
      index: chunks.length
    });
  }

  return chunks;
}

/**
 * Chunk plain text by character count with overlap
 */
function chunkText(text, source, chunkSize, overlap) {
  const chunks = [];
  let pos = 0;
  while (pos < text.length) {
    let end = pos + chunkSize;
    // Try to break at a sentence boundary
    if (end < text.length) {
      const slice = text.slice(pos, end + 200);
      const sentenceEnd = slice.lastIndexOf('. ');
      if (sentenceEnd > chunkSize * 0.7) {
        end = pos + sentenceEnd + 1;
      }
    }
    chunks.push({
      text: text.slice(pos, end).trim(),
      source,
      index: chunks.length
    });
    pos = end - overlap;
  }
  return chunks;
}

/**
 * Extract just the start time from an SRT/VTT timestamp line
 */
function extractTime(timestampLine) {
  if (!timestampLine) return '?';
  const match = timestampLine.match(/(\d{1,2}:?\d{2}:\d{2})/);
  return match ? match[1] : '?';
}

/**
 * Parse multiple files and return all chunks
 */
function parseFiles(filePaths, opts = {}) {
  const allChunks = [];
  for (const fp of filePaths) {
    try {
      const chunks = parseFile(fp, opts);
      allChunks.push(...chunks);
    } catch (err) {
      console.error(`Warning: skipping ${fp}: ${err.message}`);
    }
  }
  return allChunks;
}

module.exports = { parseFile, parseFiles, parseSRT, parseVTT, parseText };
