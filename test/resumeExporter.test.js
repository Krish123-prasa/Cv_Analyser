const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const PDFDocument = require("pdfkit");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const {
  DOCX_MIME_TYPE,
  downloadResumeDocx,
  downloadResumePdf
} = require("../server/services/resumeExporter");

function createResponse() {
  const response = new PassThrough();
  const headers = {};
  const chunks = [];
  response.setHeader = (name, value) => { headers[name.toLowerCase()] = value; };
  response.send = (buffer) => response.end(buffer);
  response.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    response.on("finish", resolve);
    response.on("error", reject);
  });
  return { response, headers, chunks, finished };
}

async function createSourcePdf(filePath) {
  const chunks = [];
  const document = new PDFDocument({
    size: [500, 700],
    margins: { top: 50, right: 55, bottom: 40, left: 65 }
  });
  document.on("data", (chunk) => chunks.push(chunk));
  await new Promise((resolve, reject) => {
    document.on("end", resolve);
    document.on("error", reject);
    document.font("Helvetica-Bold").fontSize(18).text("Jordan Davis");
    document.font("Helvetica-Bold").fontSize(12).text("Work Experience");
    document.font("Helvetica").fontSize(9).text("Product Designer | Example Co | 2021 - Present");
    document.text("- Built accessible React interfaces.");
    document.end();
  });
  await fs.writeFile(filePath, Buffer.concat(chunks));
}

test("tailored PDF export formats a monochrome resume with clear sections", async () => {
  const { response, headers, chunks, finished } = createResponse();
  const content = [
    "Jordan Davis",
    "jordan@example.com | 555-0101",
    "PROFESSIONAL SUMMARY",
    "Product designer with accessibility experience.",
    "EXPERIENCE",
    "Product Designer | Example Co | 2021 - Present",
    "- Built accessible React interfaces."
  ].join("\n");
  await downloadResumePdf(response, content, "Product Designer", null, null, (error) => {
    if (error) response.destroy(error);
  });
  await finished;
  const buffer = Buffer.concat(chunks);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
  assert.equal(headers["content-type"], "application/pdf");
  assert.match(headers["content-disposition"], /Product Designer\.pdf/);

  const parser = new PDFParse({ data: buffer });
  try {
    const extracted = await parser.getText();
    assert.match(extracted.text, /Jordan Davis/);
    assert.match(extracted.text, /PROFESSIONAL SUMMARY/);
    assert.match(extracted.text, /2021 - Present/);
    assert.match(extracted.text, /Built accessible React\s+interfaces/);
  } finally {
    await parser.destroy();
  }
});

test("tailored PDF follows the source page geometry and typography", async () => {
  const sourcePath = path.join(os.tmpdir(), "elevate-template-" + crypto.randomUUID() + ".pdf");
  await createSourcePdf(sourcePath);
  const { response, headers, chunks, finished } = createResponse();
  try {
    await downloadResumePdf(
      response,
      "Jordan Davis\nEXPERIENCE\nProduct Designer | Example Co | 2021 - Present\n- Built accessible interfaces.",
      "Product Designer",
      sourcePath,
      "Jordan Davis\nWork Experience\nProduct Designer | Example Co | 2021 - Present",
      (error) => { if (error) response.destroy(error); },
      "inline"
    );
    await finished;
    assert.match(headers["content-disposition"], /^inline;/);
    const parser = new PDFParse({ data: Buffer.concat(chunks) });
    try {
      const pdf = await parser.load();
      assert.equal(pdf.numPages, 1);
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const name = content.items.find((item) => item.str.includes("Jordan Davis"));
      const bullet = content.items.find((item) => item.str.includes("Built accessible interfaces"));
      assert.equal(viewport.width, 500);
      assert.equal(viewport.height, 700);
      assert.equal(Math.round(name.transform[4]), 65);
      assert.equal(Math.round(name.transform[0]), 18);
      assert.ok(bullet.transform[4] < 180, "body content should return to the left text column after a date line");
      assert.match(content.items.map((item) => item.str).join(" "), /Work Experience/);
    } finally {
      await parser.destroy();
    }
  } finally {
    await fs.unlink(sourcePath);
  }
});

test("PDF preview uses a safe default layout when the uploaded source is DOCX", async () => {
  const { response, chunks, finished } = createResponse();
  await downloadResumePdf(
    response,
    "Jordan Davis\nSKILLS\nPython\nPROJECTS\nBackend API:\nBuilt a REST API.",
    "Backend Developer",
    path.join(os.tmpdir(), "resume-template.docx"),
    "Jordan Davis\nSKILLS\nPython\nPROJECTS\nBackend API:\nBuilt a REST API.",
    (error) => { if (error) response.destroy(error); },
    "inline"
  );
  await finished;
  const parser = new PDFParse({ data: Buffer.concat(chunks) });
  try {
    const pdf = await parser.load();
    assert.equal(pdf.numPages, 1);
    assert.match((await parser.getText()).text, /Built a REST API/);
  } finally {
    await parser.destroy();
  }
});

test("wrapped achievement lines do not gain extra bullet markers", async () => {
  const { response, chunks, finished } = createResponse();
  const content = [
    "Jordan Davis",
    "ACHIEVEMENT",
    "• Won the Best First Year Project Award at the college hostel hackathon for developing a Hostel Room Booking",
    "System.",
    "• Recognized for innovation and practical implementation."
  ].join("\n");
  await downloadResumePdf(response, content, "Jordan Davis", null, null, (error) => {
    if (error) response.destroy(error);
  });
  await finished;
  const parser = new PDFParse({ data: Buffer.concat(chunks) });
  try {
    const pdf = await parser.load();
    const page = await pdf.getPage(1);
    const text = await page.getTextContent();
    assert.equal(text.items.filter((item) => item.str === "•").length, 2);
  } finally {
    await parser.destroy();
  }
});

test("tailored DOCX export retains Word format and structured content", async () => {
  const { response, headers, chunks, finished } = createResponse();
  await downloadResumeDocx(
    response,
    "Jordan Davis\nSKILLS\nReact | SQL\nEXPERIENCE\n- Built accessible interfaces.",
    "Product Designer"
  );
  await finished;
  const buffer = Buffer.concat(chunks);
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  assert.equal(headers["content-type"], DOCX_MIME_TYPE);
  assert.match(headers["content-disposition"], /Product Designer\.docx/);

  const extracted = await mammoth.extractRawText({ buffer });
  assert.match(extracted.value, /Jordan Davis/);
  assert.match(extracted.value, /SKILLS/);
  assert.match(extracted.value, /React \| SQL/);
  assert.match(extracted.value, /Built accessible interfaces/);
});
