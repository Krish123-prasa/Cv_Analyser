const fs = require("node:fs/promises");
const path = require("node:path");
const PDFDocument = require("pdfkit");
const { PDFParse } = require("pdf-parse");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun
} = require("docx");
const {
  alignResumeSections,
  headingFor,
  parseResumeContent,
  splitBullet,
  splitDateLine
} = require("./resumeFormatter");

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const INK = "000000";
const DEFAULT_PDF_LAYOUT = {
  pageSize: "LETTER",
  pageWidth: 612,
  pageHeight: 792,
  margins: { top: 46, right: 52, bottom: 46, left: 52 },
  fontFamily: "Helvetica",
  nameFontSize: 19,
  headingFontSize: 10.5,
  bodyFontSize: 9.5,
  lineGap: 2,
  nameAlignment: "center"
};

function safeFilename(title) {
  return (String(title || "").replace(/[^a-z0-9 _-]/gi, "").trim() || "tailored-resume").slice(0, 100);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function pdfFont(layout, bold = false) {
  if (layout.fontFamily === "Times") return bold ? "Times-Bold" : "Times-Roman";
  return bold ? "Helvetica-Bold" : "Helvetica";
}

async function inferPdfLayout(filePath) {
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  try {
    const pdf = await parser.load();
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((item) => item.str && item.str.trim());
    if (!items.length) return { ...DEFAULT_PDF_LAYOUT };

    const getSize = (item) => Math.hypot(item.transform[0], item.transform[1]) || item.height;
    const fontSizes = items.map(getSize).filter((size) => size >= 7 && size <= 14);
    const sizeCounts = new Map();
    for (const size of fontSizes) {
      const rounded = Math.round(size * 2) / 2;
      sizeCounts.set(rounded, (sizeCounts.get(rounded) || 0) + 1);
    }
    const bodyFontSize = sizeCounts.size
      ? [...sizeCounts.entries()].sort((left, right) => right[1] - left[1])[0][0]
      : DEFAULT_PDF_LAYOUT.bodyFontSize;

    const lines = [];
    for (const item of items) {
      const baseline = item.transform[5];
      let line = lines.find((candidate) => Math.abs(candidate.baseline - baseline) < 2.5);
      if (!line) {
        line = { baseline, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    }
    for (const line of lines) {
      line.items.sort((left, right) => left.transform[4] - right.transform[4]);
      line.text = line.items.map((item) => item.str).join(" ").trim();
      line.fontSize = median(line.items.map(getSize));
      line.left = Math.min(...line.items.map((item) => item.transform[4]));
      line.right = Math.max(...line.items.map((item) => item.transform[4] + item.width));
    }
    lines.sort((left, right) => right.baseline - left.baseline);

    const headingSizes = lines
      .filter((line) => headingFor(line.text))
      .map((line) => line.fontSize);
    const styles = content.styles || {};
    const fontFamilies = items.map((item) => styles[item.fontName]?.fontFamily || "");
    const serifCount = fontFamilies.filter((family) => /serif/i.test(family) && !/sans/i.test(family)).length;
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    const leftEdges = items.map((item) => item.transform[4]).filter((x) => x < pageWidth * 0.45);
    const rightEdges = items
      .map((item) => item.transform[4] + item.width)
      .filter((x) => x > pageWidth * 0.55);
    const leftMargin = percentile(leftEdges, 0.15) || DEFAULT_PDF_LAYOUT.margins.left;
    const estimatedRightMargin = pageWidth - percentile(rightEdges, 0.85);
    const rightMargin = estimatedRightMargin <= pageWidth * 0.2
      ? estimatedRightMargin
      : leftMargin;
    const firstLine = lines[0];
    const firstItem = firstLine.items[0];
    const firstStyle = styles[firstItem.fontName] || {};
    const topMargin = pageHeight - firstLine.baseline - firstLine.fontSize * (firstStyle.ascent || 0.72);
    const lastLine = lines[lines.length - 1];
    const lastItem = lastLine.items[0];
    const lastStyle = styles[lastItem.fontName] || {};
    const bottomMargin = lastLine.baseline + lastLine.fontSize * Math.abs(lastStyle.descent || -0.2);
    const nameSize = firstLine.fontSize || DEFAULT_PDF_LAYOUT.nameFontSize;
    const headingSize = headingSizes.length ? median(headingSizes) : bodyFontSize + 1;
    const nameCenter = (firstLine.left + firstLine.right) / 2;
    const lineDistances = lines.slice(1).map((line, index) => {
      const previous = lines[index];
      return previous.baseline - line.baseline;
    }).filter((distance) => distance >= bodyFontSize * 0.8 && distance <= bodyFontSize * 1.8);
    const lineGap = clamp(median(lineDistances) - bodyFontSize * 1.2, 0.5, 3.5);

    return {
      pageSize: [pageWidth, pageHeight],
      pageWidth,
      pageHeight,
      margins: {
        top: clamp(topMargin, 24, pageHeight * 0.2),
        right: clamp(rightMargin, 24, pageWidth * 0.2),
        bottom: clamp(bottomMargin, 24, pageHeight * 0.2),
        left: clamp(leftMargin, 24, pageWidth * 0.2)
      },
      fontFamily: serifCount > fontFamilies.length / 2 ? "Times" : "Helvetica",
      nameFontSize: clamp(nameSize, 12, 30),
      headingFontSize: clamp(headingSize, 8, 18),
      bodyFontSize: clamp(bodyFontSize, 7, 14),
      lineGap,
      nameAlignment: Math.abs(nameCenter - pageWidth / 2) <= pageWidth * 0.06 ? "center" : "left"
    };
  } finally {
    await parser.destroy();
  }
}

function addPdfHeader(document, profile, layout) {
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  document.font(pdfFont(layout, true)).fontSize(layout.nameFontSize).fillColor("#000000")
    .text(profile.name, { align: layout.nameAlignment, lineGap: layout.lineGap });
  document.moveDown(0.25);

  if (profile.contact.length) {
    document.font(pdfFont(layout)).fontSize(Math.max(7, layout.bodyFontSize - 1)).fillColor("#000000")
      .text(profile.contact.join("  |  "), { align: layout.nameAlignment, lineGap: layout.lineGap });
    const ruleY = document.y + 2;
    document.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(0.45).stroke("#000000");
  }
  document.moveDown(0.85);
  document.x = left;
}

function addPdfSectionHeading(document, heading, layout) {
  document.moveDown(0.12);
  document.font(pdfFont(layout, true)).fontSize(layout.headingFontSize).fillColor("#000000")
    .text(heading, { lineGap: layout.lineGap });
  const y = document.y + 2;
  document.moveTo(document.page.margins.left, y)
    .lineTo(document.page.width - document.page.margins.right, y)
    .lineWidth(0.45)
    .stroke("#000000");
  document.y = y + 2;
  document.x = document.page.margins.left;
  document.font(pdfFont(layout)).fontSize(layout.bodyFontSize).fillColor("#000000");
}

function fittedFontSize(document, text, maxWidth, fontSize, fontName) {
  document.font(fontName);
  const measuredWidth = document.widthOfString(text, { fontSize });
  return measuredWidth > maxWidth
    ? Math.max(6, fontSize * maxWidth / measuredWidth)
    : fontSize;
}

function advancePdfLine(document, y, layout) {
  document.y = y + layout.bodyFontSize * 1.2 + layout.lineGap;
  document.x = document.page.margins.left;
}

function addPdfTextLine(document, line, layout, options = {}) {
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  const regularFont = pdfFont(layout);
  const boldFont = pdfFont(layout, true);
  const bullet = options.forceBullet ? line : splitBullet(line);
  if (bullet !== null) {
    const y = document.y;
    const textLeft = left + 22;
    const fontSize = fittedFontSize(document, bullet, width - 22, layout.bodyFontSize, regularFont);
    document.font(regularFont).fontSize(fontSize).text("•", left + 5, y, {
      lineBreak: false
    });
    document.font(regularFont).fontSize(fontSize).text(bullet, textLeft, y, {
      lineGap: layout.lineGap,
      lineBreak: false
    });
    document.font(regularFont).fontSize(layout.bodyFontSize);
    advancePdfLine(document, y, layout);
    return;
  }

  const label = !options.forceBold && /^(.{1,60}?:\s*)(.*)$/.exec(line);
  if (options.forceBold || label) {
    const y = document.y;
    const prefix = label ? label[1] : line;
    const remainder = label ? label[2] : "";
    document.font(boldFont);
    const prefixWidth = document.widthOfString(prefix, { fontSize: layout.bodyFontSize });
    document.font(regularFont);
    const remainderWidth = document.widthOfString(remainder, { fontSize: layout.bodyFontSize });
    const combinedWidth = prefixWidth + remainderWidth;
    const fittedSize = combinedWidth > width
      ? Math.max(6, layout.bodyFontSize * width / combinedWidth)
      : layout.bodyFontSize;
    if (remainder) {
      document.font(boldFont).fontSize(fittedSize).text(prefix, {
        continued: true,
        lineGap: layout.lineGap,
        lineBreak: false
      });
      document.font(regularFont).fontSize(fittedSize).text(remainder, {
        lineGap: layout.lineGap,
        lineBreak: false
      });
    } else {
      document.font(boldFont).fontSize(fittedSize).text(prefix, {
        lineGap: layout.lineGap,
        lineBreak: false
      });
    }
    document.font(regularFont).fontSize(layout.bodyFontSize);
    advancePdfLine(document, y, layout);
    return;
  }

  const y = document.y;
  const fontSize = fittedFontSize(document, line, width, layout.bodyFontSize, regularFont);
  document.font(regularFont).fontSize(fontSize).text(line, left, y, {
    lineGap: layout.lineGap,
    lineBreak: false
  });
  document.font(regularFont).fontSize(layout.bodyFontSize);
  advancePdfLine(document, y, layout);
}

function addPdfBodyLine(document, line, layout, options = {}) {
  const existingBullet = splitBullet(line);
  const bullet = existingBullet !== null ? existingBullet : (options.forceBullet ? line : null);
  if (bullet !== null) return addPdfTextLine(document, bullet, layout, { forceBullet: true });

  const datedLine = splitDateLine(line);
  if (!datedLine) return addPdfTextLine(document, line, layout, options);

  const x = document.page.margins.left;
  const width = document.page.width - x - document.page.margins.right;
  const leftWidth = width * 0.72;
  const rightWidth = width - leftWidth;
  const y = document.y;
  const leftFont = pdfFont(layout, true);
  const rightFont = pdfFont(layout);
  const titleParts = /^(.+?)\s+-\s+(.+)$/.exec(datedLine.title);
  const boldTitle = titleParts ? titleParts[1] : datedLine.title;
  const regularTitle = titleParts ? " - " + titleParts[2] : "";
  document.font(leftFont);
  const boldTitleWidth = document.widthOfString(boldTitle, { fontSize: layout.bodyFontSize });
  document.font(rightFont);
  const regularTitleWidth = document.widthOfString(regularTitle, { fontSize: layout.bodyFontSize });
  const titleWidth = boldTitleWidth + regularTitleWidth;
  const titleSize = titleWidth > leftWidth
    ? Math.max(6, layout.bodyFontSize * leftWidth / titleWidth)
    : layout.bodyFontSize;
  const dateSize = fittedFontSize(document, datedLine.date, rightWidth, layout.bodyFontSize, rightFont);
  document.font(leftFont).fontSize(titleSize).text(boldTitle, x, y, {
    continued: Boolean(regularTitle),
    lineBreak: false
  });
  if (regularTitle) {
    document.font(rightFont).fontSize(titleSize).text(regularTitle, {
      lineBreak: false
    });
  }
  document.font(rightFont).fontSize(dateSize).text(datedLine.date, x + leftWidth, y, {
    width: rightWidth,
    align: "right",
    lineGap: layout.lineGap,
    lineBreak: false
  });
  const leftHeight = document.heightOfString(datedLine.title, { width: leftWidth, lineGap: layout.lineGap, fontSize: titleSize });
  const rightHeight = document.heightOfString(datedLine.date, { width: rightWidth, lineGap: layout.lineGap, fontSize: dateSize });
  document.y = y + Math.max(leftHeight, rightHeight) + 3;
  document.x = x;
  document.font(rightFont).fontSize(layout.bodyFontSize);
}

function addPdfSectionBody(document, section, layout) {
  const sectionType = headingFor(section.heading);
  for (const line of section.lines) {
    if (sectionType === "PROJECTS") {
      addPdfBodyLine(document, line, layout, {
        forceBold: /:\s*$/.test(line),
        forceBullet: !/:\s*$/.test(line)
      });
    } else if (sectionType === "PROFESSIONAL EXPERIENCE" || sectionType === "EXPERIENCE") {
      addPdfBodyLine(document, line, layout, { forceBullet: !splitDateLine(line) });
    } else if (sectionType === "CERTIFICATIONS") {
      addPdfBodyLine(document, line, layout, { forceBullet: true });
    } else {
      addPdfBodyLine(document, line, layout);
    }
  }
}

async function downloadResumePdf(res, content, title, sourcePath, sourceText, next, disposition = "attachment") {
  const isPdfSource = sourcePath && path.extname(sourcePath).toLowerCase() === ".pdf";
  const layout = isPdfSource ? await inferPdfLayout(sourcePath) : { ...DEFAULT_PDF_LAYOUT };
  const filename = safeFilename(title);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", disposition + '; filename="' + filename + '.pdf"');

  const document = new PDFDocument({
    size: layout.pageSize,
    margins: layout.margins,
    info: { Title: title, Creator: "Elevate Resume Studio" }
  });
  document.on("error", (error) => {
    if (res.headersSent) return console.error("Resume PDF export error:", error.message);
    next(error);
  });
  document.pipe(res);
  document.font(pdfFont(layout)).fontSize(layout.bodyFontSize).fillColor("#000000");

  const profile = alignResumeSections(content, sourceText, title);
  addPdfHeader(document, profile, layout);
  for (const section of profile.sections) {
    addPdfSectionHeading(document, section.heading, layout);
    addPdfSectionBody(document, section, layout);
  }
  document.end();
}

function toDocxParagraphs(content, title, sourceText) {
  const profile = alignResumeSections(content, sourceText, title);
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({
        text: profile.name,
        bold: true,
        font: "Arial",
        size: 36,
        color: INK
      })]
    })
  ];

  if (profile.contact.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({
        text: profile.contact.join("  |  "),
        font: "Arial",
        size: 18,
        color: INK
      })]
    }));
  }

  for (const section of profile.sections) {
    children.push(new Paragraph({
      spacing: { before: 180, after: 70 },
      border: {
        bottom: { color: INK, space: 3, style: BorderStyle.SINGLE, size: 5 }
      },
      children: [new TextRun({
        text: section.heading,
        bold: true,
        font: "Arial",
        size: 22,
        color: INK
      })]
    }));

    for (const line of section.lines) {
      const bullet = splitBullet(line);
      if (bullet !== null) {
        children.push(new Paragraph({
          bullet: { level: 0 },
          indent: { left: 360, hanging: 180 },
          spacing: { after: 55 },
          children: [new TextRun({ text: bullet, font: "Arial", size: 20, color: INK })]
        }));
        continue;
      }

      const datedLine = splitDateLine(line);
      if (datedLine) {
        children.push(new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: 70 },
          children: [
            new TextRun({ text: datedLine.title, bold: true, font: "Arial", size: 20, color: INK }),
            new TextRun({ text: "\t" + datedLine.date, font: "Arial", size: 18, color: INK })
          ]
        }));
        continue;
      }

      children.push(new Paragraph({
        spacing: { after: 65 },
        children: [new TextRun({ text: line, font: "Arial", size: 20, color: INK })]
      }));
    }
  }
  return children;
}

async function downloadResumeDocx(res, content, title, sourceText) {
  const document = new Document({
    creator: "Elevate Resume Studio",
    title,
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 720, right: 1080, bottom: 720, left: 1080 }
        }
      },
      children: toDocxParagraphs(content, title, sourceText)
    }]
  });
  const buffer = await Packer.toBuffer(document);
  const filename = safeFilename(title);
  res.setHeader("Content-Type", DOCX_MIME_TYPE);
  res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '.docx"');
  res.send(buffer);
}

module.exports = {
  DOCX_MIME_TYPE,
  downloadResumeDocx,
  downloadResumePdf,
  parseResumeContent,
  toDocxParagraphs
};
