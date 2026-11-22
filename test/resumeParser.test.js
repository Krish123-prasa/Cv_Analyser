const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const PDFDocument = require("pdfkit");
const { extractResumeText } = require("../server/services/resumeParser");

test("PDF upload extraction follows visual order rather than PDF text insertion order", async () => {
  const chunks = [];
  const document = new PDFDocument();
  document.on("data", (chunk) => chunks.push(chunk));
  const buffer = await new Promise((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.font("Helvetica-Bold").fontSize(18).text("Jordan Davis", 40, 35);
    document.font("Helvetica-Bold").fontSize(10).text("PROFESSIONAL SUMMARY", 40, 100);
    document.font("Helvetica").fontSize(9).text("Student with React experience.", 40, 120);
    document.font("Helvetica").fontSize(9).text("jordan@example.com | 555-0101", 40, 62);
    document.font("Helvetica-Bold").fontSize(9).text("T", 40, 150);
    document.font("Helvetica").fontSize(9).text("ools: Git", 44.5, 150);
    document.end();
  });
  const filePath = path.join(os.tmpdir(), "elevate-" + crypto.randomUUID() + ".pdf");

  try {
    await fs.writeFile(filePath, buffer);
    const text = await extractResumeText(filePath, ".pdf");
    assert.match(text, /Jordan Davis/);
    assert.match(text, /Student with React experience/);
    assert.ok(text.indexOf("jordan@example.com") < text.indexOf("PROFESSIONAL SUMMARY"));
    assert.match(text, /Tools: Git/);
  } finally {
    await fs.unlink(filePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
});
