const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema({
  degree: { type: String, trim: true, maxlength: 120, default: "" },
  field: { type: String, trim: true, maxlength: 120, default: "" },
  institution: { type: String, trim: true, maxlength: 160, default: "" },
  startYear: { type: String, trim: true, maxlength: 10, default: "" },
  endYear: { type: String, trim: true, maxlength: 10, default: "" },
  details: { type: String, trim: true, maxlength: 500, default: "" }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  userType: {
    type: String,
    enum: ["student", "graduate", "professional", "other"],
    default: "other"
  },
  headline: { type: String, trim: true, maxlength: 160, default: "" },
  phone: { type: String, trim: true, maxlength: 40, default: "" },
  location: { type: String, trim: true, maxlength: 120, default: "" },
  linkedin: { type: String, trim: true, maxlength: 240, default: "" },
  portfolio: { type: String, trim: true, maxlength: 240, default: "" },
  education: { type: [educationSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
