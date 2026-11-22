const test = require("node:test");
const assert = require("node:assert/strict");
const {
  alignResumeSections,
  parseResumeContent,
  splitBullet,
  splitDateLine
} = require("../server/services/resumeFormatter");

test("resume parser separates contact details and normalizes common section names", () => {
  const parsed = parseResumeContent([
    "Jordan Davis",
    "jordan@example.com | 555-0101",
    "Professional Summary",
    "Product designer with accessible product experience.",
    "Work History",
    "Product Designer | Example Co | 2021 - Present",
    "- Built accessible React interfaces.",
    "Technical Skills",
    "React, Figma, SQL"
  ].join("\n"));

  assert.equal(parsed.name, "Jordan Davis");
  assert.deepEqual(parsed.contact, ["jordan@example.com | 555-0101"]);
  assert.deepEqual(parsed.sections.map((section) => section.heading), [
    "PROFESSIONAL SUMMARY", "PROFESSIONAL EXPERIENCE", "SKILLS"
  ]);
  assert.deepEqual(parsed.sections[1].lines, [
    "Product Designer | Example Co | 2021 - Present",
    "- Built accessible React interfaces."
  ]);
});

test("resume formatter recognizes bullets and trailing employment dates", () => {
  assert.equal(splitBullet("  • Led a product design team."), "Led a product design team.");
  assert.deepEqual(splitDateLine("Product Designer | Example Co | Jan 2021 - Present"), {
    title: "Product Designer | Example Co",
    date: "Jan 2021 - Present"
  });
});

test("tailored sections retain the source resume's order and heading labels", () => {
  const aligned = alignResumeSections(
    "Jordan Davis\nSKILLS\nReact\nEXPERIENCE\nBuilt products.\nEDUCATION\nBSc",
    "Jordan Davis\nEducation\nBSc\nWork History\nProduct Designer\nTechnical Skills\nReact"
  );
  assert.deepEqual(aligned.sections.map((section) => section.heading), [
    "Education", "Work History", "Technical Skills"
  ]);
});
