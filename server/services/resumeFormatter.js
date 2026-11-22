const SECTION_ALIASES = new Map([
  ["summary", "PROFESSIONAL SUMMARY"],
  ["professional summary", "PROFESSIONAL SUMMARY"],
  ["executive summary", "PROFESSIONAL SUMMARY"],
  ["profile", "PROFESSIONAL SUMMARY"],
  ["professional profile", "PROFESSIONAL SUMMARY"],
  ["objective", "OBJECTIVE"],
  ["career objective", "OBJECTIVE"],
  ["experience", "PROFESSIONAL EXPERIENCE"],
  ["work experience", "PROFESSIONAL EXPERIENCE"],
  ["professional experience", "PROFESSIONAL EXPERIENCE"],
  ["employment history", "PROFESSIONAL EXPERIENCE"],
  ["employment", "PROFESSIONAL EXPERIENCE"],
  ["work history", "PROFESSIONAL EXPERIENCE"],
  ["education", "EDUCATION"],
  ["academic background", "EDUCATION"],
  ["academic history", "EDUCATION"],
  ["skills", "SKILLS"],
  ["technical skills", "SKILLS"],
  ["core skills", "SKILLS"],
  ["core competencies", "SKILLS"],
  ["relevant skills", "SKILLS"],
  ["projects", "PROJECTS"],
  ["selected projects", "PROJECTS"],
  ["project experience", "PROJECTS"],
  ["freelance projects", "PROJECTS"],
  ["certifications", "CERTIFICATIONS"],
  ["certificates", "CERTIFICATIONS"],
  ["licenses and certifications", "CERTIFICATIONS"],
  ["certifications and licenses", "CERTIFICATIONS"],
  ["awards", "AWARDS AND ACHIEVEMENTS"],
  ["awards and achievements", "AWARDS AND ACHIEVEMENTS"],
  ["awards and honors", "AWARDS AND ACHIEVEMENTS"],
  ["achievement", "AWARDS AND ACHIEVEMENTS"],
  ["achievements", "AWARDS AND ACHIEVEMENTS"],
  ["languages", "LANGUAGES"],
  ["publications", "PUBLICATIONS"],
  ["volunteer experience", "VOLUNTEER EXPERIENCE"],
  ["volunteer work", "VOLUNTEER EXPERIENCE"],
  ["professional affiliations", "PROFESSIONAL AFFILIATIONS"],
  ["affiliations", "PROFESSIONAL AFFILIATIONS"],
  ["interests", "INTERESTS"]
]);

function cleanLine(value) {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/^\s*\*\*(.*?)\*\*\s*$/, "$1")
    .replace(/^\s*__(.*?)__\s*$/, "$1")
    .trim();
}

function headingFor(line) {
  const normalized = cleanLine(line)
    .replace(/:$/, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return SECTION_ALIASES.get(normalized) || null;
}

function parseResumeContent(content, fallbackName = "Resume") {
  const lines = String(content || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
  const name = lines.shift() || fallbackName;
  const contact = [];
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    const heading = headingFor(line);
    if (heading) {
      currentSection = { heading, lines: [] };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      contact.push(line);
    }
  }

  if (!sections.length && contact.length) {
    sections.push({ heading: "PROFESSIONAL EXPERIENCE", lines: contact.splice(0) });
  }

  return { name, contact, sections };
}

function splitDateLine(line) {
  const date = "(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+)?(?:19|20)\\d{2}|present|current";
  const match = new RegExp(
    "((?:" + date + ")(?:\\s*(?:-|–|—|to)\\s*(?:" + date + "))?)$",
    "i"
  ).exec(line.trim());
  if (!match) return null;

  const before = line.slice(0, match.index).replace(/[\s|–—-]+$/, "").trim();
  if (!before) return null;
  return { title: before, date: match[0].trim() };
}

function splitBullet(line) {
  const match = /^\s*(?:[-*•▪]\s+|\d+[.)]\s+)/.exec(line);
  return match ? line.slice(match[0].length).trim() : null;
}

function alignResumeSections(content, templateContent, fallbackName = "Resume") {
  const resume = parseResumeContent(content, fallbackName);
  if (!templateContent) return resume;

  const template = parseResumeContent(templateContent);
  const labels = new Map();
  for (const line of String(templateContent).replace(/\r\n?/g, "\n").split("\n").map(cleanLine)) {
    const heading = headingFor(line);
    if (heading && !labels.has(heading)) labels.set(heading, line.replace(/:$/, "").trim());
  }

  const sectionsByHeading = new Map();
  for (const section of resume.sections) {
    const existing = sectionsByHeading.get(section.heading);
    if (existing) existing.lines.push(...section.lines);
    else sectionsByHeading.set(section.heading, { ...section, lines: [...section.lines] });
  }

  const orderedHeadings = [
    ...template.sections.map((section) => section.heading),
    ...resume.sections.map((section) => section.heading)
  ];
  const seen = new Set();
  resume.sections = orderedHeadings
    .filter((heading) => !seen.has(heading) && seen.add(heading))
    .map((heading) => {
      const section = sectionsByHeading.get(heading);
      return section ? { ...section, heading: labels.get(heading) || heading } : null;
    })
    .filter(Boolean);

  return resume;
}

module.exports = {
  alignResumeSections,
  headingFor,
  parseResumeContent,
  splitBullet,
  splitDateLine
};
