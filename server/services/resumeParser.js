const fs = require("node:fs/promises");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");

function joinTextItems(items) {
  return items.reduce((state, item) => {
    if (!state.previous) return { text: item.str, previous: item };
    const previousText = state.text.slice(-1);
    const next = item.str;
    const gap = item.transform[4] - (state.previous.transform[4] + state.previous.width);
    const fontSize = Math.hypot(item.transform[0], item.transform[1]) || item.height;
    const needsSpace = gap > Math.max(0.9, fontSize * 0.18) &&
      !/\s/.test(previousText) &&
      !/^\s/.test(next) &&
      !/^[,.;:!?)}\]]/.test(next) &&
      !/[(\[]$/.test(previousText);
    return { text: state.text + (needsSpace ? " " : "") + next, previous: item };
  }, { text: "", previous: null }).text.trim();
}

function extractVisualPageText(content) {
  const lines = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const baseline = item.transform[5];
    let line = lines.find((candidate) => Math.abs(candidate.baseline - baseline) < 2.5);
    if (!line) {
      line = { baseline, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  return lines
    .sort((left, right) => right.baseline - left.baseline)
    .map((line) => joinTextItems(line.items.sort((left, right) => left.transform[4] - right.transform[4])))
    .filter(Boolean)
    .join("\n");
}

async function extractResumeText(filePath, extension) {
  if (extension === ".pdf") {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    try {
      const pdf = await parser.load();
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(extractVisualPageText(content));
        page.cleanup();
      }
      return pages.join("\n\n").replace(/\u0000/g, "").trim();
    } finally {
      await parser.destroy();
    }
  }
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.replace(/\u0000/g, "").trim();
  }
  const error = new Error("Only PDF and DOCX resumes are supported.");
  error.status = 415;
  throw error;
}

module.exports = { extractResumeText };
