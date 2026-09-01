const express = require("express");
const Recipe = require("../models/recipe");
const Comment = require("../models/comment");
const middleware = require("../middleware");

const router = express.Router({ mergeParams: true });

router.post("/", middleware.socialRateLimit, middleware.isLoggedIn, middleware.loadRecipe, async (req, res) => {
  const text = String((req.body.comment && req.body.comment.text) || req.body.text || "").trim();
  if (!text) {
    req.flash("error", "Comment cannot be empty.");
    return res.redirect(req.recipe.url);
  }
  const comment = await Comment.create({ text: text.slice(0, 2000), author: { id: req.user._id, screenName: req.user.screenName }, recipe: req.recipe._id });
  await Recipe.updateOne({ _id: req.recipe._id }, { $push: { comments: comment._id } });
  req.flash("success", "Comment posted.");
  res.redirect(`${req.recipe.url}#comments`);
});

router.delete("/:comment_id", middleware.socialRateLimit, middleware.isLoggedIn, middleware.loadRecipe, middleware.checkCommentOwnership, async (req, res) => {
  await req.comment.deleteOne();
  await Recipe.updateOne({ _id: req.recipe._id }, { $pull: { comments: req.comment._id } });
  req.flash("success", "Comment deleted.");
  res.redirect(`${req.recipe.url}#comments`);
});

module.exports = router;
