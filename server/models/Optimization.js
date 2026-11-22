const mongoose = require("mongoose");

const optimizationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sourceResume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  role: { type: String, trim: true, maxlength: 120, default: "" },
  jobDescription: { type: String, required: true, maxlength: 20000 },
  analysis: { type: mongoose.Schema.Types.Mixed, required: true },
  content: { type: String, required: true },
  outputFormat: { type: String, enum: ["pdf", "docx"], default: "pdf" },
  mode: { type: String, enum: ["ai", "keyword"], default: "keyword" }
}, { timestamps: true });

module.exports = mongoose.model("Optimization", optimizationSchema);
