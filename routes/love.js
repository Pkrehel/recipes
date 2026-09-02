const express = require("express");
const Recipe = require("../models/recipe");
const User = require("../models/user");
const middleware = require("../middleware");

const router = express.Router({ mergeParams: true });

// Toggle favorite. POST and DELETE both toggle so old templates keep working.
async function toggle(req, res) {
  const recipe = req.recipe;
  const already = recipe.lovedBy.some((id) => id.equals(req.user._id));
  if (already) {
    await Promise.all([Recipe.updateOne({ _id: recipe._id }, { $pull: { lovedBy: req.user._id } }), User.updateOne({ _id: req.user._id }, { $pull: { lovedRecipes: recipe._id } })]);
    req.flash("success", `"${recipe.title}" was removed from your favorites.`);
  } else {
    await Promise.all([Recipe.updateOne({ _id: recipe._id }, { $addToSet: { lovedBy: req.user._id } }), User.updateOne({ _id: req.user._id }, { $addToSet: { lovedRecipes: recipe._id } })]);
    req.flash("success", `"${recipe.title}" was added to your favorites!`);
  }
  if (req.get("Accept") && req.get("Accept").includes("application/json")) {
    return res.json({ loved: !already, count: recipe.lovedBy.length + (already ? -1 : 1) });
  }
  middleware.back(req, res, recipe.url);
}

router.post("/", middleware.socialRateLimit, middleware.isLoggedIn, middleware.loadRecipe, toggle);
router.delete("/", middleware.socialRateLimit, middleware.isLoggedIn, middleware.loadRecipe, toggle);

module.exports = router;
