const express = require("express");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");
const { normalizeProfileUpdate, serializeProfile } = require("../services/profile");
const httpError = require("../utils/httpError");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw httpError(401, "Please sign in to continue.");
    res.json({ user: serializeProfile(user) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/", async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw httpError(401, "Please sign in to continue.");
    user.set(normalizeProfileUpdate(req.body));
    await user.save();
    res.json({ user: serializeProfile(user) });
  } catch (error) {
    if (error.code === 11000) return next(httpError(409, "An account with this email already exists."));
    return next(error);
  }
});

module.exports = router;
