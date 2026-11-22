const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");
const { serializeProfile } = require("../services/profile");
const httpError = require("../utils/httpError");

const router = express.Router();
const signInLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again later." }
});
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

function setSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("elevate_session", token, cookieOptions);
}

router.post("/register", signInLimit, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 2 || name.length > 80) throw httpError(400, "Name must be between 2 and 80 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw httpError(400, "Enter a valid email address.");
    }
    if (password.length < 8 || password.length > 128) {
      throw httpError(400, "Password must be between 8 and 128 characters.");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    setSession(res, user);
    res.status(201).json({ user: serializeProfile(user) });
  } catch (error) {
    if (error.code === 11000) return next(httpError(409, "An account with this email already exists."));
    return next(error);
  }
});

router.post("/login", signInLimit, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw httpError(401, "Email or password is incorrect.");
    }
    setSession(res, user);
    res.json({ user: serializeProfile(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("elevate_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw httpError(401, "Please sign in to continue.");
    res.json({ user: serializeProfile(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
