const express = require("express");
const path = require("node:path");
const rateLimit = require("express-rate-limit");
const Optimization = require("../models/Optimization");
const Resume = require("../models/Resume");
const requireAuth = require("../middleware/requireAuth");
const { analyzeResume, tailorResume } = require("../services/analyzer");
const { downloadResumeDocx, downloadResumePdf } = require("../services/resumeExporter");
const { extractResumeText } = require("../services/resumeParser");
const httpError = require("../utils/httpError");
const mongoose = require("mongoose");

const router = express.Router();
const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "server/uploads");
const generationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skip: () => !process.env.OPENAI_API_KEY,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "You've reached the hourly generation limit. Please try again later." }
});

function serializeOptimization(item) {
  return {
    id: item._id.toString(),
    sourceResumeId: item.sourceResume && item.sourceResume._id
      ? item.sourceResume._id.toString()
      : String(item.sourceResume),
    sourceTitle: item.sourceResume && item.sourceResume.title ? item.sourceResume.title : "",
    title: item.title,
    role: item.role,
    mode: item.mode,
    outputFormat: item.outputFormat || "pdf",
    analysis: item.analysis,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function loadSourceResume(req, sourceResume) {
  if (!sourceResume) throw httpError(404, "The source resume for this tailored version no longer exists.");
  const sourcePath = path.join(uploadRoot, String(req.userId), path.basename(sourceResume.storageName));
  const extension = path.extname(sourceResume.originalName).toLowerCase();
  const sourceText = await extractResumeText(sourcePath, extension);
  if (sourceResume.extractedText !== sourceText) {
    sourceResume.extractedText = sourceText;
    await sourceResume.save();
  }
  return { sourcePath, sourceText };
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const optimizations = await Optimization.find({ owner: req.userId })
      .populate("sourceResume", "title")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ optimizations: optimizations.map(serializeOptimization) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", generationLimit, async (req, res, next) => {
  try {
    const sourceResumeId = typeof req.body.resumeId === "string" ? req.body.resumeId : "";
    const jobDescription = typeof req.body.jobDescription === "string" ? req.body.jobDescription.trim() : "";
    const role = typeof req.body.role === "string" ? req.body.role.trim().slice(0, 120) : "";
    const requestedFormat = typeof req.body.outputFormat === "string" ? req.body.outputFormat : "";
    if (jobDescription.length < 30 || jobDescription.length > 20000) {
      throw httpError(400, "Job description must be between 30 and 20,000 characters.");
    }
    if (requestedFormat && !["pdf", "docx"].includes(requestedFormat)) {
      throw httpError(400, "Choose PDF or DOCX as the download format.");
    }
    if (!mongoose.Types.ObjectId.isValid(sourceResumeId)) throw httpError(400, "Invalid resume id.");
    const resume = await Resume.findOne({ _id: sourceResumeId, owner: req.userId });
    if (!resume) throw httpError(404, "Choose one of your saved resumes first.");
    const { sourceText } = await loadSourceResume(req, resume);
    const [analysis, content] = await Promise.all([
      analyzeResume(sourceText, jobDescription, role),
      tailorResume(sourceText, jobDescription, role)
    ]);
    const mode = process.env.OPENAI_API_KEY ? "ai" : "keyword";
    const sourceFormat = path.extname(resume.originalName).toLowerCase() === ".docx" ? "docx" : "pdf";
    const outputFormat = requestedFormat || sourceFormat;
    const optimization = await Optimization.create({
      owner: req.userId,
      sourceResume: resume._id,
      title: role || resume.title,
      role,
      jobDescription,
      analysis,
      content,
      mode,
      outputFormat
    });
    const item = await Optimization.findById(optimization._id)
      .populate("sourceResume", "title")
      .lean();
    res.status(201).json({
      optimization: serializeOptimization(item),
      content,
      changed: content !== sourceText
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/preview", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, "Invalid tailored resume id.");
    const optimization = await Optimization.findOne({ _id: req.params.id, owner: req.userId })
      .select("title content outputFormat sourceResume")
      .populate("sourceResume", "originalName storageName extractedText");
    if (!optimization) throw httpError(404, "Tailored resume not found.");
    const { sourcePath, sourceText } = await loadSourceResume(req, optimization.sourceResume);
    await downloadResumePdf(
      res,
      optimization.content,
      optimization.title,
      path.extname(optimization.sourceResume.originalName).toLowerCase() === ".pdf" ? sourcePath : null,
      sourceText,
      next,
      "inline"
    );
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, "Invalid tailored resume id.");
    const optimization = await Optimization.findOne({ _id: req.params.id, owner: req.userId })
      .select("title content outputFormat sourceResume")
      .populate("sourceResume", "originalName storageName extractedText");
    if (!optimization) throw httpError(404, "Tailored resume not found.");
    const sourceResume = optimization.sourceResume;
    if (!sourceResume) throw httpError(404, "The source resume for this tailored version no longer exists.");
    const { sourcePath, sourceText } = await loadSourceResume(req, sourceResume);
    if (optimization.outputFormat === "docx") {
      await downloadResumeDocx(res, optimization.content, optimization.title, sourceText);
    } else {
      await downloadResumePdf(
        res,
        optimization.content,
        optimization.title,
        path.extname(sourceResume.originalName).toLowerCase() === ".pdf" ? sourcePath : null,
        sourceText,
        next
      );
    }
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, "Invalid tailored resume id.");
    const result = await Optimization.deleteOne({ _id: req.params.id, owner: req.userId });
    if (!result.deletedCount) throw httpError(404, "Tailored resume not found.");
    res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
