const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const Resume = require("../models/Resume");
const Optimization = require("../models/Optimization");
const requireAuth = require("../middleware/requireAuth");
const { analyzeResume } = require("../services/analyzer");
const { extractResumeText } = require("../services/resumeParser");
const httpError = require("../utils/httpError");

const router = express.Router();
const analysisLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "You've reached the hourly analysis limit. Please try again later." }
});
const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "server/uploads");
const storage = multer.diskStorage({
  destination(req, _file, callback) {
    const destination = path.join(uploadRoot, String(req.userId));
    fs.mkdir(destination, { recursive: true }).then(() => callback(null, destination), callback);
  },
  filename(_req, file, callback) {
    callback(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase());
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (![".pdf", ".docx"].includes(extension)) {
      return callback(httpError(415, "Choose a PDF or DOCX resume."));
    }
    callback(null, true);
  }
});

function serializeResume(resume) {
  return {
    id: resume._id.toString(),
    title: resume.title,
    originalName: resume.originalName,
    size: resume.size,
    lastRole: resume.lastRole,
    lastAnalysis: resume.lastAnalysis,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt
  };
}

function safeFilename(name) {
  return path.basename(name).replace(/[\r\n"]/g, "_").slice(0, 180) || "resume";
}

function uploadMiddleware(req, res, next) {
  upload.single("resume")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      error.status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      error.message = error.code === "LIMIT_FILE_SIZE"
        ? "Resume must be 10 MB or smaller."
        : "Unable to receive the resume file.";
    }
    return next(error);
  });
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const resumes = await Resume.find({ owner: req.userId }).sort({ updatedAt: -1 }).lean();
    res.json({ resumes: resumes.map(serializeResume) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", uploadMiddleware, async (req, res, next) => {
  let uploadedPath;
  try {
    if (!req.file) throw httpError(400, "Choose a PDF or DOCX resume to upload.");
    uploadedPath = req.file.path;
    const extension = path.extname(req.file.originalname).toLowerCase();
    const extractedText = await extractResumeText(req.file.path, extension);
    if (extractedText.length < 30) {
      throw httpError(422, "We could not find enough readable text in this file. Try a text-based PDF or DOCX.");
    }
    if (extractedText.length > 100000) {
      throw httpError(422, "This resume contains too much text to process. Please upload a shorter document.");
    }

    const resume = await Resume.create({
      owner: req.userId,
      title: path.basename(req.file.originalname, extension).replace(/[_-]+/g, " ").slice(0, 120),
      originalName: safeFilename(req.file.originalname),
      storageName: path.basename(req.file.filename),
      mimeType: req.file.mimetype,
      size: req.file.size,
      extractedText
    });
    res.status(201).json({ resume: serializeResume(resume) });
  } catch (error) {
    if (uploadedPath) {
      try {
        await fs.unlink(uploadedPath);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") console.error("Unable to clean failed upload:", cleanupError.message);
      }
    }
    return next(error);
  }
});

router.post("/:id/analyze", analysisLimit, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, "Invalid resume id.");
    const jobDescription = typeof req.body.jobDescription === "string" ? req.body.jobDescription.trim() : "";
    const role = typeof req.body.role === "string" ? req.body.role.trim().slice(0, 120) : "";
    if (jobDescription.length < 30 || jobDescription.length > 20000) {
      throw httpError(400, "Job description must be between 30 and 20,000 characters.");
    }

    const resume = await Resume.findOne({ _id: req.params.id, owner: req.userId });
    if (!resume) throw httpError(404, "Resume not found.");
    const filePath = path.join(uploadRoot, String(req.userId), resume.storageName);
    resume.extractedText = await extractResumeText(filePath, path.extname(resume.originalName).toLowerCase());
    const analysis = await analyzeResume(resume.extractedText, jobDescription, role);
    resume.lastRole = role;
    resume.lastAnalysis = analysis;
    await resume.save();
    res.json({ analysis, resume: serializeResume(resume) });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, "Invalid resume id.");
    const resume = await Resume.findOne({ _id: req.params.id, owner: req.userId });
    if (!resume) throw httpError(404, "Resume not found.");
    const filePath = path.join(uploadRoot, String(req.userId), resume.storageName);
    res.download(filePath, safeFilename(resume.originalName), (error) => {
      if (error) next(error);
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, "Invalid resume id.");
    const resume = await Resume.findOne({ _id: req.params.id, owner: req.userId });
    if (!resume) throw httpError(404, "Resume not found.");
    const filePath = path.join(uploadRoot, String(req.userId), resume.storageName);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await Optimization.deleteMany({ sourceResume: resume._id, owner: req.userId });
    await resume.deleteOne();
    res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
