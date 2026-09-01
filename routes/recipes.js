const express = require("express");
const sanitizeHtml = require("sanitize-html");
const Recipe = require("../models/recipe");
const User = require("../models/user");
const Review = require("../models/review");
const Comment = require("../models/comment");
const middleware = require("../middleware");
const seo = require("../lib/seo");
const images = require("../lib/cloudinary");

const router = express.Router();

const SANITIZE = {
  allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h3", "h4", "blockquote", "a"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }) }
};

const toList = (v) =>
  (Array.isArray(v) ? v : v ? [v] : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 100);

const toInt = (v, min, max, dflt = 0) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.min(Math.max(n, min), max);
};

function fieldsFromBody(body) {
  const prepTime = toInt(body.prepTime, 0, 10000);
  const cookTime = toInt(body.cookTime, 0, 10000);
  const description = sanitizeHtml(seo.textToHtml(body.description), SANITIZE).trim();
  const summaryInput = String(body.summary || "").trim();
  return {
    title: String(body.title || "").trim(),
    description,
    summary: seo.truncate(summaryInput || seo.stripHtml(description), 300),
    ingredients: toList(body.ingredients),
    directions: toList(body.directions),
    prepTime,
    cookTime,
    totalTime: prepTime + cookTime,
    servings: body.servings ? toInt(body.servings, 1, 500, undefined) : undefined,
    allergens: toList(body.allergens).filter((a) => Recipe.DIETS.includes(a)),
    tags: toList(body.tags ? String(body.tags).split(",") : []).map((t) => t.toLowerCase()).slice(0, 15),
    cuisine: String(body.cuisine || "").trim().slice(0, 60) || undefined,
    category: Recipe.CATEGORIES.includes(body.category) ? body.category : "Other",
    difficulty: toInt(body.difficulty, 0, 2)
  };
}

// NEW form
router.get("/new", middleware.isLoggedIn, middleware.isVerified, (req, res) => {
  res.render("recipes/new", { meta: res.locals.buildMeta({ title: "Share a recipe", robots: "noindex,nofollow" }) });
});

// CREATE
router.post("/", middleware.recipeRateLimit, middleware.isLoggedIn, middleware.isVerified, images.upload.single("image"), async (req, res) => {
  const fields = fieldsFromBody(req.body);
  if (!req.file) {
    req.flash("error", "Please upload a photo of your recipe.");
    return res.redirect("/recipes/new");
  }
  if (!images.isConfigured()) {
    req.flash("error", "Image uploads are not configured on this server yet.");
    return res.redirect("/recipes/new");
  }
  const result = await images.uploadBuffer(req.file.buffer);
  const recipe = await Recipe.create({
    ...fields,
    slug: await Recipe.uniqueSlug(fields.title),
    image: result.secure_url,
    imageId: result.public_id,
    chef: { id: req.user._id, screenName: req.user.screenName, avatar: req.user.avatar }
  });
  await User.updateOne({ _id: req.user._id }, { $addToSet: { recipes: recipe._id } });
  req.flash("success", "Your recipe is live!");
  res.redirect(recipe.url);
});

// SHOW (slug, with legacy ObjectId -> 301 to slug)
router.get("/:slug", middleware.loadRecipe, async (req, res) => {
  const recipe = req.recipe;
  if (req.params.slug !== recipe.slug) return res.redirect(301, recipe.url);

  const [reviews, comments] = await Promise.all([
    Review.find({ recipe: recipe._id }).sort("-createdAt").lean(),
    Comment.find({ recipe: recipe._id }).sort("-createdAt").lean()
  ]);

  const isOwner = req.user && req.user._id.equals(recipe.chef.id);
  if (!isOwner) Recipe.updateOne({ _id: recipe._id }, { $inc: { views: 1 } }).exec();

  const plain = recipe.toObject({ virtuals: true });
  const description = plain.summary || seo.truncate(seo.stripHtml(plain.description), 155);
  const meta = res.locals.buildMeta({
    title: `${plain.title} Recipe`,
    description,
    canonical: plain.url,
    ogType: "article",
    image: plain.image,
    imageAlt: plain.title,
    publishedTime: plain.createdAt,
    modifiedTime: plain.updatedAt,
    jsonLd: [
      seo.recipeJsonLd(plain, reviews),
      seo.breadcrumbJsonLd([
        { name: "Home", url: "/" },
        { name: `${plain.category} Recipes`, url: `/recipes/collections/${plain.category.toLowerCase()}` },
        { name: plain.title, url: plain.url }
      ])
    ]
  });

  const userReview = req.user ? reviews.find((r) => r.author.id.equals(req.user._id)) : null;
  const loved = req.user ? recipe.lovedBy.some((id) => id.equals(req.user._id)) : false;

  res.render("recipes/show", { meta, recipe: plain, reviews, comments, isOwner, userReview, loved });
});

// EDIT form
router.get("/:slug/edit", middleware.isLoggedIn, middleware.loadRecipe, middleware.checkRecipeOwnership, (req, res) => {
  res.render("recipes/edit", { meta: res.locals.buildMeta({ title: `Edit ${req.recipe.title}`, robots: "noindex,nofollow" }), recipe: req.recipe.toObject({ virtuals: true }) });
});

// UPDATE
router.put("/:slug", middleware.recipeRateLimit, middleware.isLoggedIn, middleware.loadRecipe, middleware.checkRecipeOwnership, images.upload.single("image"), async (req, res) => {
  const recipe = req.recipe;
  const fields = fieldsFromBody(req.body);

  if (req.file) {
    if (!images.isConfigured()) {
      req.flash("error", "Image uploads are not configured on this server yet.");
      return res.redirect(`${recipe.url}/edit`);
    }
    const result = await images.uploadBuffer(req.file.buffer);
    await images.destroy(recipe.imageId);
    recipe.image = result.secure_url;
    recipe.imageId = result.public_id;
  }

  if (fields.title && fields.title !== recipe.title) {
    // Keep existing slug stable for SEO unless the owner explicitly asks to regenerate it.
    if (req.body.regenerateSlug === "on") recipe.slug = await Recipe.uniqueSlug(fields.title, recipe._id);
  }
  Object.assign(recipe, fields);
  recipe.chef.screenName = req.user.screenName;
  recipe.chef.avatar = req.user.avatar;
  await recipe.save();
  req.flash("success", "Recipe updated.");
  res.redirect(recipe.url);
});

// DELETE
router.delete("/:slug", middleware.recipeRateLimit, middleware.isLoggedIn, middleware.loadRecipe, middleware.checkRecipeOwnership, async (req, res) => {
  const recipe = req.recipe;
  await Promise.all([
    Review.deleteMany({ recipe: recipe._id }),
    Comment.deleteMany({ recipe: recipe._id }),
    User.updateMany({ $or: [{ recipes: recipe._id }, { lovedRecipes: recipe._id }] }, { $pull: { recipes: recipe._id, lovedRecipes: recipe._id } }),
    images.destroy(recipe.imageId)
  ]);
  await recipe.deleteOne();
  req.flash("success", `"${recipe.title}" was deleted.`);
  res.redirect(`/users/${req.user._id}`);
});

module.exports = router;
