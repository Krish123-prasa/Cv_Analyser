const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeProfileUpdate, serializeProfile } = require("../server/services/profile");

test("profile updates normalize account and academic details", () => {
  assert.deepEqual(normalizeProfileUpdate({
    name: "  Jordan Davis ",
    email: " JORDAN@example.com ",
    userType: "student",
    linkedin: "linkedin.com/in/jordan",
    education: [{
      degree: " B.Sc. ",
      field: " Computer Science ",
      institution: " Example University ",
      startYear: "2022",
      endYear: "2026",
      details: ""
    }, { degree: "", field: "", institution: "", startYear: "", endYear: "", details: "" }]
  }), {
    name: "Jordan Davis",
    email: "jordan@example.com",
    userType: "student",
    linkedin: "https://linkedin.com/in/jordan",
    education: [{
      degree: "B.Sc.",
      field: "Computer Science",
      institution: "Example University",
      startYear: "2022",
      endYear: "2026",
      details: ""
    }]
  });
});

test("profile updates reject unsafe fields and invalid values", () => {
  assert.throws(() => normalizeProfileUpdate({ passwordHash: "new-hash" }), /unsupported profile field/i);
  assert.throws(() => normalizeProfileUpdate({ userType: "admin" }), /valid user type/i);
  assert.throws(() => normalizeProfileUpdate({ email: "not-an-email" }), /valid email/i);
  assert.throws(() => normalizeProfileUpdate({ linkedin: "javascript:alert(1)" }), /valid LinkedIn URL/i);
  assert.throws(() => normalizeProfileUpdate({ education: Array(13).fill({}) }), /no more than 12/i);
});

test("serialized profile never exposes credential fields", () => {
  const user = {
    _id: { toString: () => "user-id" },
    name: "Jordan Davis",
    email: "jordan@example.com",
    passwordHash: "secret",
    education: [{ degree: "B.Sc.", institution: "Example University" }]
  };
  const serialized = serializeProfile(user);
  assert.equal(serialized.id, "user-id");
  assert.equal(serialized.userType, "other");
  assert.deepEqual(serialized.education, [{
    degree: "B.Sc.",
    field: "",
    institution: "Example University",
    startYear: "",
    endYear: "",
    details: ""
  }]);
  assert.equal(Object.prototype.hasOwnProperty.call(serialized, "passwordHash"), false);
});
