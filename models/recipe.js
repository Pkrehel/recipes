const mongoose = require("mongoose");
const { slugify } = require("../lib/seo");

const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Beverage", "Other"];
const DIETS = ["Gluten-Free", "Vegetarian", "Vegan", "Dairy-Free", "Nut-Free"];

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true }, // sanitized HTML from the editor
    summary: { type: String, maxlength: 320 }, // plain-text, used for meta description + JSON-LD
    image: { type: String, required: true },
    imageId: { type: String, required: true },
    chef: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      screenName: String,
      avatar: String
    },
    prepTime: { type: Number, min: 0, max: 10000, default: 0 },
    cookTime: { type: Number, min: 0, max: 10000, default: 0 },
    totalTime: { type: Number, min: 0, default: 0 },
    servings: { type: Number, min: 1, max: 500 },
    directions: { type: [String], required: true, validate: (v) => v.length > 0 },
    ingredients: { type: [String], required: true, validate: (v) => v.length > 0 },
    tags: [String],
    allergens: { type: [String], enum: DIETS },
    category: { type: String, enum: CATEGORIES, required: true },
    cuisine: { type: String, maxlength: 60 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    lovedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    difficulty: { type: Number, enum: [0, 1, 2], default: 0 },
    views: { type: Number, default: 0 },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
    rating: { type: Number, default: 0 }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

recipeSchema.index({ title: "text", description: "text", ingredients: "text", tags: "text" }, { weights: { title: 10, tags: 5, ingredients: 3, description: 1 } });
recipeSchema.index({ category: 1, createdAt: -1 });
recipeSchema.index({ allergens: 1 });

recipeSchema.statics.CATEGORIES = CATEGORIES;
recipeSchema.statics.DIETS = DIETS;

// Generate a unique slug from the title when the title changes.
recipeSchema.statics.uniqueSlug = async function (title, excludeId) {
  const base = slugify(title) || "recipe";
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await this.findOne({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).select("_id").lean();
    if (!clash) return slug;
    slug = `${base}-${n++}`;
  }
};

recipeSchema.virtual("url").get(function () {
  return `/recipes/${this.slug}`;
});

recipeSchema.virtual("difficultyLabel").get(function () {
  return ["Easy", "Medium", "Challenging"][this.difficulty] || "Easy";
});

module.exports = mongoose.model("Recipe", recipeSchema);
