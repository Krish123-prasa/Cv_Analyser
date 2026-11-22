const OpenAI = require("openai");
const httpError = require("../utils/httpError");
const { headingFor, splitBullet } = require("./resumeFormatter");

const SKILLS = [
  "accessibility", "agile", "analytics", "aws", "communication", "css", "customer success",
  "data analysis", "data visualization", "design systems", "docker", "figma", "git", "html",
  "illustrator", "java", "javascript", "leadership", "machine learning", "market research",
  "mongodb", "node.js", "product management", "product strategy", "project management",
  "prototyping", "python", "react", "salesforce", "scrum", "seo", "sql",
  "stakeholder management", "teamwork", "typescript", "user research", "usability testing",
  "wireframing"
];

const TAILORING_STOP_WORDS = new Set([
  "ability", "about", "across", "and", "are", "as", "at", "be", "by", "candidate", "for",
  "from", "have", "in", "include", "including", "into", "is", "it", "job", "knowledge",
  "of", "on", "or", "our", "preferred", "required", "role", "skills", "strong", "team",
  "that", "the", "their", "this", "to", "understanding", "we", "who", "will", "with",
  "work", "years", "you", "your"
]);

function containsTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp("(^|[^a-z0-9])" + escaped + "($|[^a-z0-9])", "i").test(text);
}

function findSkills(text) {
  const normalized = String(text || "").toLowerCase();
  return SKILLS.filter((skill) => containsTerm(normalized, skill));
}

function tailoringTerms(jobDescription, role) {
  const weights = new Map();
  const roleText = String(role || "").toLowerCase();
  const jobText = String(jobDescription || "").toLowerCase();
  for (const skill of findSkills(jobText)) weights.set(skill, 5);
  for (const rawWord of roleText.match(/[a-z0-9+#.]+/g) || []) {
    const word = rawWord.replace(/^\.+|\.+$/g, "");
    if (word.length >= 3 && !TAILORING_STOP_WORDS.has(word)) {
      weights.set(word, Math.max(weights.get(word) || 0, 3));
    }
  }
  for (const rawWord of jobText.match(/[a-z0-9+#.]+/g) || []) {
    const word = rawWord.replace(/^\.+|\.+$/g, "");
    if (word.length >= 4 && !TAILORING_STOP_WORDS.has(word)) {
      weights.set(word, Math.max(weights.get(word) || 0, 1));
    }
  }
  return [...weights.entries()];
}

function relevanceScore(text, terms) {
  return terms.reduce((score, [term, weight]) =>
    score + (containsTerm(text, term) ? weight : 0), 0);
}

function wrapText(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (line && candidate.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function splitSummarySentences(text) {
  const sentences = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!/[.!?]/.test(text[index]) || (index + 1 < text.length && !/\s/.test(text[index + 1]))) continue;
    const fragment = text.slice(start, index + 1).trim();
    if (text[index] === "." && /(?:\b(?:B|M|Ph)\.Tech|\b(?:e\.g|i\.e|Mr|Ms|Dr))\.$/i.test(fragment)) continue;
    const next = text.slice(index + 1).match(/\S/);
    if (next && !/[A-Z]/.test(next[0])) continue;
    if (fragment) sentences.push(fragment);
    start = index + 1;
  }
  const remainder = text.slice(start).trim();
  if (remainder) sentences.push(remainder);
  return sentences;
}

function tailorSummary(lines, terms, role, jobDescription) {
  if (!lines.length || lines.some((line) => !line.trim())) return lines;
  const summary = lines.join(" ").replace(/\s+/g, " ").trim();
  const cleanRole = String(role || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(?:intern|internship)$/i, "")
    .slice(0, 24);
  const sentences = splitSummarySentences(summary);
  const rankedSentences = sentences.map((sentence, index) => ({
    sentence: sentence.trim(),
    index,
    score: relevanceScore(sentence, terms)
  }));
  rankedSentences.sort((left, right) => right.score - left.score || left.index - right.index);
  const rankedSummary = rankedSentences.map((item) => item.sentence).join(" ");
  const tailoredSummary = cleanRole
    ? rankedSummary.replace(
      /seeking internship opportunities/i,
      () => "targeting " + cleanRole + (/intern(ship)?\b/i.test(String(jobDescription || "") + " " + String(role || ""))
        ? " internships"
        : " roles")
    )
    : rankedSummary;
  const width = Math.max(...lines.map((line) => line.length));
  const wrapped = wrapText(tailoredSummary, width);
  return wrapped.length === lines.length ? wrapped : lines;
}

function summaryLead(text) {
  const sentences = splitSummarySentences(text);
  const sentence = sentences.find((item) =>
    /\b(?:student|graduate|engineer|developer|designer|analyst|scientist|architect|manager|consultant|professional)\b/i
      .test(item)
  );
  if (!sentence) return "";
  const match = /\b(?:student|graduate|engineer|developer|designer|analyst|scientist|architect|manager|consultant|professional)\b/i.exec(sentence);
  return sentence.slice(0, match.index + match[0].length).trim().replace(/[,:;]+$/, "");
}

function summarySkills(section, terms) {
  if (!section) return [];
  return section.body.flatMap((line) => {
    const colon = line.indexOf(":");
    if (colon < 0) return [];
    return line.slice(colon + 1).split(/[,;|]/)
      .map((item) => item.trim().replace(/[.!?]+$/, ""))
      .filter((item) => item && relevanceScore(item, terms) > 0)
      .map((item) => ({ item, score: relevanceScore(item, terms) }));
  }).sort((left, right) => right.score - left.score)
    .map((entry) => entry.item)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4);
}

function summaryEvidence(sections, terms) {
  return sections
    .filter((section) => section.heading === "PROJECTS" || section.heading === "PROFESSIONAL EXPERIENCE")
    .flatMap((section) => section.body.map((line, index) => {
      const text = splitBullet(line) || line.trim();
      return {
        text,
        score: relevanceScore(text, terms),
        index: section.start + index
      };
    }))
    .filter((item) => item.score > 0 && item.text.length <= 180 && !/:$/.test(item.text))
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function createTailoredSummary(lines, sections, terms, role, jobDescription) {
  const original = tailorSummary(lines, terms, role, jobDescription);
  if (!lines.length || lines.some((line) => !line.trim())) return original;
  const summaryText = lines.join(" ").replace(/\s+/g, " ").trim();
  const lead = summaryLead(summaryText);
  const cleanRole = String(role || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+(?:intern|internship)$/i, "")
    .slice(0, 24);
  if (!lead || !cleanRole) return original;

  const targetType = /\bintern(ship)?\b/i.test(String(jobDescription || "") + " " + String(role || ""))
    ? "internships"
    : "roles";
  const evidence = summaryEvidence(sections, terms)[0];
  const skills = summarySkills(sections.find((section) => section.heading === "SKILLS"), terms);
  if (!evidence && !skills.length) return original;

  const tailored = [lead + " targeting " + cleanRole + " " + targetType + "."];
  if (evidence) {
    tailored.push(/[.!?]$/.test(evidence.text) ? evidence.text : evidence.text + ".");
  }
  if (skills.length) {
    const skillText = skills.length === 1
      ? skills[0]
      : skills.slice(0, -1).join(", ") + " and " + skills[skills.length - 1];
    tailored.push("Relevant skills include " + skillText + ".");
  }
  const width = Math.max(...lines.map((line) => line.length));
  const wrapped = wrapText(tailored.join(" "), width);
  return wrapped.length <= lines.filter((line) => line.trim()).length + 1 ? wrapped : original;
}

function reorderSkillLine(line, terms) {
  const colon = line.indexOf(":");
  if (colon < 0) return line;
  const prefix = line.slice(0, colon + 1);
  const value = line.slice(colon + 1);
  const spacing = /^\s*/.exec(value)[0];
  const separator = /,\s*/.exec(value);
  if (!separator) return line;
  const trimmedValue = value.trim();
  const punctuation = /[.!?]+$/.exec(trimmedValue);
  const listValue = punctuation ? trimmedValue.slice(0, -punctuation[0].length) : trimmedValue;
  const items = listValue.split(/,\s*/).map((text, index) => ({
    text,
    index,
    score: relevanceScore(text, terms)
  }));
  if (items.length < 2) return line;
  items.sort((left, right) => right.score - left.score || left.index - right.index);
  return prefix + spacing + items.map((item) => item.text).join(separator[0]) + (punctuation ? punctuation[0] : "");
}

function reorderProjectGroups(lines, terms) {
  const groups = [];
  let preamble = [];
  for (const line of lines) {
    if (/^\s*[^:]{2,60}:\s*$/.test(line)) {
      groups.push({ lines: [line], score: 0, index: groups.length });
    } else if (groups.length) {
      groups[groups.length - 1].lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (groups.length < 2) return lines;
  for (const group of groups) group.score = relevanceScore(group.lines.join(" "), terms);
  groups.sort((left, right) => right.score - left.score || left.index - right.index);
  return preamble.concat(groups.flatMap((group) => group.lines));
}

function localTailorResume(resumeText, jobDescription, role) {
  const source = String(resumeText || "").slice(0, 50000);
  const lines = source.split(/\r?\n/);
  const terms = tailoringTerms(jobDescription, role);
  const sections = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = headingFor(lines[index]);
    if (heading) sections.push({ heading, start: index, end: lines.length });
  }
  for (let index = 0; index < sections.length - 1; index += 1) {
    sections[index].end = sections[index + 1].start;
  }

  for (const section of sections) {
    section.body = lines.slice(section.start + 1, section.end);
  }
  const changes = [];
  for (const section of sections) {
    const start = section.start + 1;
    const body = section.body;
    let updated = body;
    if (section.heading === "PROFESSIONAL SUMMARY" || section.heading === "OBJECTIVE") {
      updated = createTailoredSummary(body, sections, terms, role, jobDescription);
    } else if (section.heading === "SKILLS") {
      updated = body.map((line) => reorderSkillLine(line, terms));
    } else if (section.heading === "PROJECTS") {
      updated = reorderProjectGroups(body, terms);
    }
    if (updated.join("\n") !== body.join("\n")) changes.push({ start, count: body.length, updated });
  }
  changes.sort((left, right) => right.start - left.start);
  for (const change of changes) lines.splice(change.start, change.count, ...change.updated);
  return lines.join("\n").slice(0, 50000);
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 100))
    .filter(Boolean))].slice(0, 12);
}

function normalizeAnalysis(value) {
  if (!value || typeof value !== "object") {
    throw httpError(502, "The AI provider returned an invalid analysis.");
  }
  const score = Number(value.score);
  if (!Number.isFinite(score) || score < 0 || score > 100 || typeof value.summary !== "string") {
    throw httpError(502, "The AI provider returned an invalid analysis.");
  }
  return {
    score: Math.round(score),
    matchedSkills: cleanList(value.matchedSkills),
    missingSkills: cleanList(value.missingSkills),
    recommendations: cleanList(value.recommendations),
    summary: value.summary.trim().slice(0, 600),
    mode: "ai"
  };
}

function localAnalysis(resumeText, jobDescription) {
  const requiredSkills = findSkills(jobDescription);
  const profileSkills = findSkills(resumeText);
  const matchedSkills = requiredSkills.filter((skill) => profileSkills.includes(skill));
  const missingSkills = requiredSkills.filter((skill) => !profileSkills.includes(skill));
  const score = requiredSkills.length
    ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
    : 0;
  const recommendations = missingSkills.slice(0, 5).map((skill) =>
    "If you have relevant experience, make your " + skill + " work easier to find."
  );

  return {
    score,
    matchedSkills,
    missingSkills,
    recommendations,
    summary: requiredSkills.length
      ? matchedSkills.length + " of " + requiredSkills.length + " recognized job skills appear in the resume text."
      : "No skills from the built-in keyword list were detected in this job description.",
    mode: "keyword"
  };
}

function applyResumeEdits(sourceText, edits) {
  const source = String(sourceText || "");
  if (!Array.isArray(edits) || edits.length > 30) {
    throw httpError(502, "The AI provider returned invalid resume edits.");
  }

  const replacements = [];
  for (const edit of edits) {
    if (!edit || typeof edit.sourceText !== "string" || typeof edit.replacementText !== "string") {
      throw httpError(502, "The AI provider returned invalid resume edits.");
    }
    const original = edit.sourceText;
    const replacement = edit.replacementText;
    const maxLength = Math.max(original.length + 8, Math.floor(original.length * 1.35));
    if (
      !original.trim() ||
      !replacement.trim() ||
      /[\u0000-\u001f\u007f]/.test(original + replacement) ||
      replacement.length > maxLength ||
      headingFor(original)
    ) {
      throw httpError(502, "The AI provider returned resume edits that change the source structure.");
    }

    const start = source.indexOf(original);
    if (start < 0 || source.indexOf(original, start + original.length) >= 0) {
      throw httpError(502, "The AI provider returned resume edits that do not uniquely match the source.");
    }
    const end = start + original.length;
    if (replacements.some((item) => start < item.end && end > item.start)) {
      throw httpError(502, "The AI provider returned overlapping resume edits.");
    }
    replacements.push({ start, end, text: replacement });
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), source)
    .slice(0, 50000);
}

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });
}

async function analyzeResume(resumeText, jobDescription, role) {
  const client = getClient();
  if (!client) return localAnalysis(resumeText, jobDescription);

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a careful resume analyst. Compare only information explicitly present in the resume against the job description. Never invent candidate experience or claim a missing skill means the candidate lacks it. Return only a JSON object with score (0-100), matchedSkills (string array), missingSkills (string array of requirements not found in the resume), recommendations (string array of truthful improvements), and summary (string)."
        },
        {
          role: "user",
          content: "Target role: " + (role || "Not specified") +
            "\n\nJOB DESCRIPTION\n" + jobDescription.slice(0, 20000) +
            "\n\nRESUME TEXT\n" + resumeText.slice(0, 35000)
        }
      ]
    });
    const content = completion.choices[0] && completion.choices[0].message.content;
    if (!content) throw httpError(502, "The AI provider returned an empty analysis.");
    const jsonText = content.replace(/^```(?:json)?\s*|\s*```$/g, "");
    return normalizeAnalysis(JSON.parse(jsonText));
  } catch (error) {
    if (error.isOperational) throw error;
    console.error("Resume analysis provider error:", error.message);
    throw httpError(502, "Resume analysis failed. Check the AI provider configuration and try again.");
  }
}

async function tailorResume(resumeText, jobDescription, role) {
  const client = getClient();
  if (!client) return localTailorResume(resumeText, jobDescription, role);

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Tailor the resume to the job description using only facts in the source resume. Return only JSON in this exact shape: {\"edits\":[{\"sourceText\":\"an exact, unique, single-line phrase from the source resume\",\"replacementText\":\"the tailored replacement for that phrase\"}]}. Never fabricate or change skills, employers, credentials, dates, numbers, metrics, or accomplishments. Edit only existing summary or experience wording where the source supports a clearer job-specific phrasing. Do not edit the candidate's name, contact details, section headings, education, certifications, awards, or dates. Do not add, remove, reorder, or summarize any source content. Choose short exact phrases that appear once; keep replacementText on one line and approximately the same length. Every source phrase not explicitly replaced will be retained verbatim."
        },
        {
          role: "user",
          content: "Target role: " + (role || "Not specified") +
                  "\n\nJOB DESCRIPTION\n" + jobDescription.slice(0, 20000) +
            "\n\nSOURCE RESUME\n" + resumeText.slice(0, 35000)
        }
      ]
    });
    const content = completion.choices[0] && completion.choices[0].message.content;
    if (!content || !content.trim()) throw httpError(502, "The AI provider returned an empty resume.");
    const jsonText = content.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const result = JSON.parse(jsonText);
    return applyResumeEdits(resumeText, result.edits);
  } catch (error) {
    if (error.isOperational) throw error;
    console.error("Resume generation provider error:", error.message);
    throw httpError(502, "Resume generation failed. Check the AI provider configuration and try again.");
  }
}

module.exports = {
  applyResumeEdits,
  analyzeResume,
  findSkills,
  localAnalysis,
  localTailorResume,
  normalizeAnalysis,
  tailorResume
};
