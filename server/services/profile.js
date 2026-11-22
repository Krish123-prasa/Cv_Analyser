const httpError = require("../utils/httpError");

const PROFILE_FIELDS = new Set([
  "name",
  "email",
  "userType",
  "headline",
  "phone",
  "location",
  "linkedin",
  "portfolio",
  "education"
]);
const EDUCATION_FIELDS = new Set([
  "degree",
  "field",
  "institution",
  "startYear",
  "endYear",
  "details"
]);
const PROFILE_LIMITS = {
  name: 80,
  headline: 160,
  phone: 40,
  location: 120,
  linkedin: 240,
  portfolio: 240
};
const USER_TYPES = new Set(["student", "graduate", "professional", "other"]);

function normalizeOptionalUrl(value, field) {
  if (!value) return "";
  const withProtocol = /^https?:\/\//i.test(value) ? value : "https://" + value;
  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol.");
    return url.toString();
  } catch {
    throw httpError(400, "Enter a valid " + field + " URL.");
  }
}

function normalizeEducation(value) {
  if (!Array.isArray(value) || value.length > 12) {
    throw httpError(400, "Add no more than 12 education entries.");
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw httpError(400, "Each education entry must be an object.");
    }
    for (const key of Object.keys(entry)) {
      if (!EDUCATION_FIELDS.has(key)) throw httpError(400, "Unsupported education field.");
    }
    const education = {};
    for (const field of EDUCATION_FIELDS) {
      const fieldValue = entry[field] === undefined ? "" : entry[field];
      if (typeof fieldValue !== "string") throw httpError(400, "Education details must be text.");
      const limit = field === "details" ? 500 : field === "institution" ? 160 : 120;
      education[field] = fieldValue.trim().slice(0, limit);
    }
    return education;
  }).filter((entry) => Object.values(entry).some(Boolean));
}

function normalizeProfileUpdate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw httpError(400, "Profile details must be sent as an object.");
  }
  const keys = Object.keys(value);
  if (!keys.length) throw httpError(400, "Add at least one profile detail to update.");
  for (const key of keys) {
    if (!PROFILE_FIELDS.has(key)) throw httpError(400, "Unsupported profile field.");
  }

  const update = {};
  for (const field of ["name", "email", "headline", "phone", "location", "linkedin", "portfolio"]) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) continue;
    if (typeof value[field] !== "string") throw httpError(400, "Profile details must be text.");
    const normalized = value[field].trim();
    if (field === "name" && (normalized.length < 2 || normalized.length > PROFILE_LIMITS.name)) {
      throw httpError(400, "Name must be between 2 and 80 characters.");
    }
    if (field === "email") {
      const email = normalized.toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw httpError(400, "Enter a valid email address.");
      }
      update.email = email;
    } else if (normalized.length > PROFILE_LIMITS[field]) {
      throw httpError(400, field + " must be " + PROFILE_LIMITS[field] + " characters or fewer.");
    } else if (field === "linkedin" || field === "portfolio") {
      update[field] = normalizeOptionalUrl(normalized, field === "linkedin" ? "LinkedIn" : "portfolio");
    } else {
      update[field] = normalized;
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, "userType")) {
    if (typeof value.userType !== "string" || !USER_TYPES.has(value.userType)) {
      throw httpError(400, "Choose a valid user type.");
    }
    update.userType = value.userType;
  }
  if (Object.prototype.hasOwnProperty.call(value, "education")) {
    update.education = normalizeEducation(value.education);
  }
  return update;
}

function serializeProfile(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    userType: user.userType || "other",
    headline: user.headline || "",
    phone: user.phone || "",
    location: user.location || "",
    linkedin: user.linkedin || "",
    portfolio: user.portfolio || "",
    education: (user.education || []).map((entry) => ({
      degree: entry.degree || "",
      field: entry.field || "",
      institution: entry.institution || "",
      startYear: entry.startYear || "",
      endYear: entry.endYear || "",
      details: entry.details || ""
    }))
  };
}

module.exports = { normalizeProfileUpdate, serializeProfile };
