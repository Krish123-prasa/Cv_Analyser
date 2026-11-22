const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const {
  analyzeResume,
  applyResumeEdits,
  findSkills,
  localAnalysis,
  localTailorResume,
  normalizeAnalysis,
  tailorResume
} = require("../server/services/analyzer");

test("skill detection uses word boundaries and recognizes known multiword skills", () => {
  assert.deepEqual(findSkills("JavaScript, Java, and stakeholder management"), [
    "java", "javascript", "stakeholder management"
  ]);
});

test("local analysis distinguishes supported matches from potential gaps", () => {
  const analysis = localAnalysis(
    "Built dashboards in React and SQL with a small product team.",
    "We need React, SQL, and stakeholder management experience."
  );
  assert.equal(analysis.score, 67);
  assert.deepEqual(analysis.matchedSkills, ["react", "sql"]);
  assert.deepEqual(analysis.missingSkills, ["stakeholder management"]);
  assert.equal(analysis.mode, "keyword");
});

test("AI results are normalized and invalid provider output is rejected", () => {
  assert.deepEqual(normalizeAnalysis({
    score: 80,
    matchedSkills: ["  SQL ", "SQL"],
    missingSkills: [],
    recommendations: ["Show relevant work."],
    summary: "A useful match."
  }), {
    score: 80,
    matchedSkills: ["SQL"],
    missingSkills: [],
    recommendations: ["Show relevant work."],
    summary: "A useful match.",
    mode: "ai"
  });
  assert.throws(() => normalizeAnalysis({ score: 120, summary: "Bad score." }), /invalid analysis/i);
});

test("local tailoring prioritizes existing job-matched content without inventing facts", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const source = [
      "Jordan Davis",
      "PROFESSIONAL SUMMARY",
      "Motivated B.Tech Information Technology student with experience in JavaScript, Python and REST APIs.",
      "Seeking internship opportunities to apply my skills and grow professionally.",
      "SKILLS",
      "Technical: JavaScript, Python, REST APIs.",
      "PROJECTS",
      "UI Portfolio:",
      "Built responsive interfaces with JavaScript.",
      "Python ETL:",
      "Created data pipelines with Python, Flask and REST APIs."
    ].join("\n");
    const tailored = await tailorResume(
      source,
      "The internship uses Python, Flask and REST APIs to build data pipelines.",
      "Python Developer Intern"
    );

    assert.notEqual(tailored, source);
    assert.match(tailored, /targeting Python Developer internships/i);
    assert.match(tailored, /Motivated B\.Tech Information Technology student/);
    assert.match(tailored, /Technical: Python, REST APIs, JavaScript\./);
    assert.ok(tailored.indexOf("Python ETL:") < tailored.indexOf("UI Portfolio:"));
    assert.match(tailored, /Created data pipelines with Python, Flask and REST APIs\./);
    assert.doesNotMatch(tailored, /stakeholder management/i);
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("local tailoring leaves content unchanged when no safe reordering is available", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const source = "Jordan Davis\nSKILLS\nGit\nPython, JavaScript\nEXPERIENCE\nBuilt web tools.";
  try {
    const tailored = await tailorResume(source, "Python and JavaScript are required.", "Developer");
    assert.equal(tailored, source);
    assert.doesNotMatch(tailored, /Target role|Relevant skills/);
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("local tailoring uses supported backend evidence without adding missing Java requirements", () => {
  const source = [
    "Jordan Davis",
    "PROFESSIONAL SUMMARY",
    "Motivated B.Tech Information Technology student with Python and full-stack development experience.",
    "Seeking internship opportunities to apply skills and grow professionally.",
    "Project work includes backend services.",
    "SKILLS",
    "Concepts: REST APIs, Object Oriented Programming.",
    "PROJECTS",
    "Hostel Management:",
    "Developed backend services using Python Flask."
  ].join("\n");
  const tailored = localTailorResume(
    source,
    "Develop backend applications using Java and Spring Boot. Design RESTful APIs.",
    "Backend Developer"
  );
  const summary = tailored.slice(tailored.indexOf("PROFESSIONAL SUMMARY"), tailored.indexOf("\nSKILLS"));
  assert.match(summary, /targeting Backend Developer roles/i);
  assert.match(summary.replace(/\s+/g, " "), /Developed backend services using Python Flask/);
  assert.match(summary, /Relevant skills include REST APIs/);
  assert.doesNotMatch(summary, /\bJava\b|Spring Boot/i);
});

test("resume edits preserve all source text outside explicitly replaced phrases", () => {
  const source = "Jordan Davis\nSUMMARY\nBuilt tools with Python.\nEDUCATION\nB.Tech, 2024–2028";
  const tailored = applyResumeEdits(source, [{
    sourceText: "Built tools with Python.",
    replacementText: "Built Python tools."
  }]);
  assert.equal(tailored, "Jordan Davis\nSUMMARY\nBuilt Python tools.\nEDUCATION\nB.Tech, 2024–2028");
  assert.throws(() => applyResumeEdits("Python and Python", [{
    sourceText: "Python",
    replacementText: "Python API"
  }]), /uniquely match/i);
});

test("OpenAI-compatible analysis and tailoring use the configured provider", async () => {
  let requests = 0;
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests += 1;
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const tailoring = body.messages[0].content.includes("Tailor the resume");
      const content = tailoring
        ? JSON.stringify({
          edits: [{ sourceText: "React interfaces", replacementText: "React web interfaces" }]
        })
        : JSON.stringify({
          score: 80,
          matchedSkills: ["React"],
          missingSkills: ["SQL"],
          recommendations: ["Mention SQL only if supported by your experience."],
          summary: "One listed skill was not found."
        });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 1,
        model: "test-model",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }]
      }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const originalEnvironment = {
    key: process.env.OPENAI_API_KEY,
    base: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL
  };
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:" + server.address().port + "/v1";
  process.env.OPENAI_MODEL = "test-model";

  try {
    const analysis = await analyzeResume("React interfaces", "React and SQL role requirements.", "Designer");
    assert.equal(analysis.mode, "ai");
    assert.equal(analysis.score, 80);
    assert.deepEqual(analysis.missingSkills, ["SQL"]);
    const tailored = await tailorResume(
      "Jordan Davis\nEXPERIENCE\nBuilt React interfaces.",
      "React and SQL role requirements.",
      "Designer"
    );
    assert.equal(tailored, "Jordan Davis\nEXPERIENCE\nBuilt React web interfaces.");
    assert.equal(requests, 2);
  } finally {
    if (originalEnvironment.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalEnvironment.key;
    if (originalEnvironment.base === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = originalEnvironment.base;
    if (originalEnvironment.model === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalEnvironment.model;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
