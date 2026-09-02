const express = require("express");
const Recipe = require("../models/recipe");
const middleware = require("../middleware");
const seo = require("../lib/seo");

const router = express.Router();
const SORTS = ["createdAt", "views", "rating", "totalTime", "title"];
const PUBLIC_FIELDS = "title slug summary image category allergens difficulty prepTime cookTime totalTime servings rating views tags cuisine createdAt updatedAt chef.screenName";

router.use(middleware.apiRateLimit);

/**
 * GET /api/v1/recipes?limit=20&offset=0&orderBy=createdAt&sortBy=-1&category=Dinner&q=chicken
 * Public, read-only JSON. Handy for AI agents / GEO and any future front end.
 */
router.get("/v1/recipes", async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const orderBy = SORTS.includes(req.query.orderBy) ? req.query.orderBy : "createdAt";
  const sort = (req.query.sortBy === "1" ? "" : "-") + orderBy;
  const filter = {};
  if (Recipe.CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (Recipe.DIETS.includes(req.query.diet)) filter.allergens = req.query.diet;
  if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };

  const [items, total] = await Promise.all([Recipe.find(filter).select(PUBLIC_FIELDS).sort(sort).skip(offset).limit(limit).lean(), Recipe.countDocuments(filter)]);
  res.set("Cache-Control", "public, max-age=60");
  res.json({
    total,
    limit,
    offset,
    items: items.map((r) => ({ ...r, url: seo.absolute(`/recipes/${r.slug}`), image: seo.imageUrl(r.image, { width: 800 }) }))
  });
});

router.get("/v1/recipes/:slug", async (req, res) => {
  const recipe = await Recipe.findOne({ slug: req.params.slug }).lean();
  if (!recipe) return res.status(404).json({ error: "not found" });
  const Review = require("../models/review");
  const reviews = await Review.find({ recipe: recipe._id }).lean();
  res.set("Cache-Control", "public, max-age=300");
  res.json({ ...seo.recipeJsonLd(recipe, reviews), url: seo.absolute(`/recipes/${recipe.slug}`) });
});

module.exports = router;
