const { rateLimit } = require("express-rate-limit");
const mongoose = require("mongoose");
const Recipe = require("../models/recipe");
const Comment = require("../models/comment");
const Review = require("../models/review");

const isTest = process.env.NODE_ENV === "test";

/** Express 5 removed res.redirect("back"); this reproduces it with a safe fallback. */
function back(req, res, fallback = "/") {
  const ref = req.get("Referer") || "";
  let target = fallback;
  try {
    const u = new URL(ref, `${req.protocol}://${req.get("host")}`);
    if (u.host === req.get("host")) target = u.pathname + u.search;
  } catch (_) {
    /* ignore */
  }
  return res.redirect(target);
}

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.session.returnTo = req.originalUrl;
  req.flash("error", "You need to be logged in to do that.");
  res.redirect("/login");
}

function isVerified(req, res, next) {
  if (req.user && req.user.verified) return next();
  req.flash("error", "Please verify your email address before posting. Check your inbox or request a new link from your profile.");
  res.redirect(req.user ? `/users/${req.user._id}` : "/login");
}

/** Find a recipe by slug or legacy ObjectId; attaches req.recipe. */
async function loadRecipe(req, res, next) {
  const key = req.params.id || req.params.slug;
  let recipe = null;
  if (mongoose.isValidObjectId(key)) recipe = await Recipe.findById(key);
  if (!recipe) recipe = await Recipe.findOne({ slug: key });
  if (!recipe) {
    res.status(404);
    req.flash("error", "We couldn't find that recipe. It may have been removed.");
    return res.render("errors/404", { meta: res.locals.buildMeta({ title: "Recipe not found", robots: "noindex" }) });
  }
  req.recipe = recipe;
  next();
}

function checkRecipeOwnership(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("error", "You need to be logged in to do that.");
    return res.redirect("/login");
  }
  if (!req.recipe.chef.id.equals(req.user._id)) {
    req.flash("error", "You can only edit or delete your own recipes.");
    return res.redirect(req.recipe.url);
  }
  next();
}

async function checkCommentOwnership(req, res, next) {
  const comment = await Comment.findById(req.params.comment_id);
  if (!comment) {
    req.flash("error", "Comment not found.");
    return back(req, res);
  }
  if (!comment.author.id.equals(req.user._id)) {
    req.flash("error", "You can only delete your own comments.");
    return back(req, res);
  }
  req.comment = comment;
  next();
}

async function checkReviewOwnership(req, res, next) {
  const review = await Review.findById(req.params.review_id);
  if (!review) {
    req.flash("error", "Review not found.");
    return back(req, res);
  }
  if (!review.author.id.equals(req.user._id)) {
    req.flash("error", "You can only delete your own reviews.");
    return back(req, res);
  }
  req.review = review;
  next();
}

async function checkReviewExistence(req, res, next) {
  const existing = await Review.findOne({ recipe: req.recipe._id, "author.id": req.user._id }).select("_id").lean();
  if (existing) {
    req.flash("error", "You already reviewed this recipe. Delete your review to write a new one.");
    return res.redirect(req.recipe.url);
  }
  next();
}

const limiter = (opts) =>
  rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => isTest,
    handler(req, res) {
      res.status(429);
      req.flash("error", "You're doing that too often. Please wait a few minutes and try again.");
      back(req, res);
    },
    ...opts
  });

module.exports = {
  back,
  isLoggedIn,
  isVerified,
  loadRecipe,
  checkRecipeOwnership,
  checkCommentOwnership,
  checkReviewOwnership,
  checkReviewExistence,
  globalRateLimit: limiter({ windowMs: 60 * 1000, limit: 300 }),
  accountRateLimit: limiter({ windowMs: 10 * 60 * 1000, limit: 20 }),
  recipeRateLimit: limiter({ windowMs: 10 * 60 * 1000, limit: 15 }),
  socialRateLimit: limiter({ windowMs: 60 * 1000, limit: 30 }),
  apiRateLimit: limiter({ windowMs: 60 * 1000, limit: 60, handler: (req, res) => res.status(429).json({ error: "rate limited" }) })
};
