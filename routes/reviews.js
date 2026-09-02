const express = require("express");
const Recipe = require("../models/recipe");
const Review = require("../models/review");
const middleware = require("../middleware");

const router = express.Router({ mergeParams: true });

async function recalcRating(recipeId) {
  const reviews = await Review.find({ recipe: recipeId }).select("_id rating").lean();
  const avg = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;
  await Recipe.updateOne({ _id: recipeId }, { $set: { rating: avg, reviews: reviews.map((r) => r._id) } });
}

router.post("/", middleware.socialRateLimit, middleware.isLoggedIn, middleware.loadRecipe, middleware.checkReviewExistence, async (req, res) => {
  const body = req.body.review || {};
  await Review.create({
    rating: Number(body.rating),
    text: String(body.text || "").trim().slice(0, 2000),
    author: { id: req.user._id, screenName: req.user.screenName },
    recipe: req.recipe._id
  });
  await recalcRating(req.recipe._id);
  req.flash("success", "Thanks for your review!");
  res.redirect(req.recipe.url);
});

router.delete("/:review_id", middleware.socialRateLimit, middleware.isLoggedIn, middleware.loadRecipe, middleware.checkReviewOwnership, async (req, res) => {
  await req.review.deleteOne();
  await recalcRating(req.recipe._id);
  req.flash("success", "Your review was deleted.");
  res.redirect(req.recipe.url);
});

module.exports = router;
