const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  originalName: { type: String, required: true },
  storageName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  extractedText: { type: String, required: true },
  lastRole: { type: String, default: "" },
  lastAnalysis: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

module.exports = mongoose.model("Resume", resumeSchema);
