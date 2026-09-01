const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const Recipe = require("../models/recipe");
const middleware = require("../middleware");
const seo = require("../lib/seo");

const router = express.Router();

const PER_PAGE_DEFAULT = 12;
const PER_PAGE_MAX = 24;
const SORTS = { createdAt: "Newest", views: "Most viewed", rating: "Highest rated", totalTime: "Quickest" };

// Curated browse pages: pretty, crawlable URLs that map to a filter + SEO copy.
const COLLECTIONS = {
  vegetarian: { title: "Vegetarian Recipes", description: "Meat-free recipes for every meal, from quick weeknight dinners to weekend brunch.", filter: { allergens: "Vegetarian" } },
  vegan: { title: "Vegan Recipes", description: "Plant-based recipes with no animal products.", filter: { allergens: "Vegan" } },
  "gluten-free": { title: "Gluten-Free Recipes", description: "Recipes made without wheat, barley or rye.", filter: { allergens: "Gluten-Free" } },
  "dairy-free": { title: "Dairy-Free Recipes", description: "Recipes with no milk, cheese, butter or cream.", filter: { allergens: "Dairy-Free" } },
  "nut-free": { title: "Nut-Free Recipes", description: "Recipes that skip peanuts and tree nuts.", filter: { allergens: "Nut-Free" } },
  breakfast: { title: "Breakfast Recipes", description: "Start the day right with pancakes, eggs, oats and more.", filter: { category: "Breakfast" } },
  lunch: { title: "Lunch Recipes", description: "Sandwiches, salads, bowls and soups for midday.", filter: { category: "Lunch" } },
  dinner: { title: "Dinner Recipes", description: "Main courses for weeknights and special occasions.", filter: { category: "Dinner" } },
  snack: { title: "Snack Recipes", description: "Small bites and appetizers.", filter: { category: "Snack" } },
  dessert: { title: "Dessert Recipes", description: "Cakes, cookies, pies and sweet treats.", filter: { category: "Dessert" } },
  beverage: { title: "Drink Recipes", description: "Cocktails, smoothies, coffee and more.", filter: { category: "Beverage" } },
  easy: { title: "Easy Recipes", description: "Beginner-friendly recipes with simple steps.", filter: { difficulty: 0 } },
  intermediate: { title: "Intermediate Recipes", description: "Recipes for confident home cooks.", filter: { difficulty: 1 } },
  challenging: { title: "Challenging Recipes", description: "Ambitious recipes worth the effort.", filter: { difficulty: 2 } },
  quick: { title: "Quick Recipes (10 minutes or less)", description: "Recipes you can finish in ten minutes or less.", filter: { totalTime: { $lte: 10 } } },
  "under-45-minutes": { title: "Recipes Under 45 Minutes", description: "Recipes that take between 11 and 45 minutes.", filter: { totalTime: { $gt: 10, $lte: 45 } } },
  "weekend-projects": { title: "Long Recipes (45+ minutes)", description: "Slow cooks, bakes and braises for when you have time.", filter: { totalTime: { $gt: 45 } } },
  "most-viewed": { title: "Most Viewed Recipes", description: "The recipes our community looks at most.", filter: {}, sort: "-views" },
  "highest-rated": { title: "Highest Rated Recipes", description: "Top-rated recipes according to reviews.", filter: { rating: { $gt: 0 } }, sort: "-rating" }
};
router.COLLECTIONS = COLLECTIONS;

function parsePaging(req) {
  let perPage = parseInt(req.query.pageLimit, 10) || PER_PAGE_DEFAULT;
  perPage = Math.min(Math.max(perPage, 1), PER_PAGE_MAX);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  return { perPage, page };
}

function parseSort(req, fallback = "-createdAt") {
  const orderBy = SORTS[req.query.orderBy] ? req.query.orderBy : null;
  if (!orderBy) return fallback;
  return (req.query.sortBy === "1" ? "" : "-") + orderBy;
}

function pageUrl(basePath, query, page) {
  const q = new URLSearchParams(query);
  if (page > 1) q.set("page", page);
  else q.delete("page");
  const s = q.toString();
  return basePath + (s ? `?${s}` : "");
}

async function renderListing(req, res, { filter, sort, basePath, title, description, view = "home", robots, canonicalQuery = {} }) {
  const { perPage, page } = parsePaging(req);
  const [recipes, count] = await Promise.all([
    Recipe.find(filter)
      .sort(sort)
      .skip(perPage * (page - 1))
      .limit(perPage)
      .lean(),
    Recipe.countDocuments(filter)
  ]);
  const pages = Math.max(Math.ceil(count / perPage), 1);
  const pageTitle = page > 1 ? `${title} (Page ${page})` : title;
  const keep = { ...canonicalQuery };
  if (req.query.pageLimit && Number(req.query.pageLimit) !== PER_PAGE_DEFAULT) keep.pageLimit = req.query.pageLimit;
  if (req.query.orderBy && SORTS[req.query.orderBy]) keep.orderBy = req.query.orderBy;
  if (req.query.sortBy === "1") keep.sortBy = "1";

  const meta = res.locals.buildMeta({
    title: pageTitle,
    description,
    canonical: pageUrl(basePath, keep, page),
    robots: robots || (count === 0 ? "noindex,follow" : undefined),
    prev: page > 1 ? pageUrl(basePath, keep, page - 1) : null,
    next: page < pages ? pageUrl(basePath, keep, page + 1) : null,
    image: recipes[0]?.image,
    jsonLd: [seo.websiteJsonLd(), seo.itemListJsonLd(recipes, { name: pageTitle, url: pageUrl(basePath, keep, page) })]
  });

  res.render(view, {
    meta,
    recipes,
    pageTitle: title,
    description,
    current: page,
    pages,
    count,
    perPage,
    sorts: SORTS,
    pageUrl: (p) => pageUrl(basePath, keep, p),
    basePath,
    query: keep
  });
}

// ---------- Home ----------
router.get("/", async (req, res) => {
  // Legacy query-string filters (still supported): ?category=Dinner&allergens=Vegan&difficulty=1&lt=45&gt=10
  const filter = {};
  const q = req.query;
  if (Recipe.CATEGORIES.includes(q.category)) filter.category = q.category;
  if (Recipe.DIETS.includes(q.allergens)) filter.allergens = q.allergens;
  if (["0", "1", "2"].includes(q.difficulty)) filter.difficulty = Number(q.difficulty);
  const lt = parseInt(q.lt, 10);
  const gt = parseInt(q.gt, 10);
  if (lt || gt) filter.totalTime = { ...(gt ? { $gt: gt } : {}), ...(lt ? { $lt: lt } : {}) };

  // Redirect legacy filter URLs to their canonical collection page when one matches.
  if (Object.keys(filter).length === 1) {
    const match = Object.entries(COLLECTIONS).find(([, c]) => JSON.stringify(c.filter) === JSON.stringify(filter) && !c.sort);
    if (match) return res.redirect(301, `/recipes/collections/${match[0]}`);
  }

  const filtered = Object.keys(filter).length > 0;
  await renderListing(req, res, {
    filter,
    sort: parseSort(req),
    basePath: "/",
    title: filtered ? String(q.pageTitle || "Filtered Recipes").slice(0, 80) : "Recent Recipes",
    description: filtered ? `Browse ${String(q.pageTitle || "recipes").toLowerCase()} shared by home cooks.` : `${seo.SITE.tagline} Browse the newest recipes shared by our community of home cooks, with ingredients, step-by-step directions, prep and cook times, and reviews.`,
    robots: filtered ? "noindex,follow" : undefined,
    canonicalQuery: filtered ? Object.fromEntries(Object.entries(q).filter(([k]) => ["category", "allergens", "difficulty", "lt", "gt"].includes(k))) : {}
  });
});

// ---------- Curated collections ----------
router.get("/recipes/collections/:collection", async (req, res, next) => {
  const c = COLLECTIONS[req.params.collection];
  if (!c) return next();
  await renderListing(req, res, {
    filter: c.filter,
    sort: c.sort || parseSort(req),
    basePath: `/recipes/collections/${req.params.collection}`,
    title: c.title,
    description: `${c.description} Every recipe includes ingredients, step-by-step directions, prep and cook times, and community reviews.`
  });
});

// ---------- Search ----------
router.get("/s", async (req, res) => {
  const term = String(req.query.search || "").trim().slice(0, 100);
  if (!term) return res.redirect("/");
  const filter = { $text: { $search: term } };
  const { perPage, page } = parsePaging(req);
  let recipes;
  let count;
  try {
    [recipes, count] = await Promise.all([
      Recipe.find(filter, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, createdAt: -1 })
        .skip(perPage * (page - 1))
        .limit(perPage)
        .lean(),
      Recipe.countDocuments(filter)
    ]);
  } catch (_) {
    // Fallback if the text index doesn't exist yet
    const rx = new RegExp(escapeRegex(term), "i");
    const or = { $or: [{ title: rx }, { tags: rx }, { ingredients: rx }, { description: rx }] };
    [recipes, count] = await Promise.all([Recipe.find(or).sort("-createdAt").skip(perPage * (page - 1)).limit(perPage).lean(), Recipe.countDocuments(or)]);
  }
  const pages = Math.max(Math.ceil(count / perPage), 1);
  const basePath = "/s";
  const keep = { search: term };
  res.render("search", {
    meta: res.locals.buildMeta({ title: `Search results for "${term}"`, robots: "noindex,follow", canonical: pageUrl(basePath, keep, page) }),
    recipes,
    term,
    count,
    current: page,
    pages,
    perPage,
    pageTitle: `Results for "${term}"`,
    pageUrl: (p) => pageUrl(basePath, keep, p)
  });
});

// ---------- User profiles ----------
router.get("/users/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return next();
  const foundUser = await User.findById(req.params.id).populate("recipes lovedRecipes").lean();
  if (!foundUser) return next();
  const isOwner = req.user && req.user._id.equals(foundUser._id);
  res.render("users/profile", {
    meta: res.locals.buildMeta({
      title: `${foundUser.screenName}'s recipes`,
      description: foundUser.bio || `Recipes shared by ${foundUser.screenName} on ${seo.SITE.name}.`,
      robots: isOwner || foundUser.recipes.length === 0 ? "noindex,follow" : undefined,
      jsonLd: [seo.profileJsonLd(foundUser)]
    }),
    foundUser,
    isOwner
  });
});

router.put("/users/:id", middleware.accountRateLimit, middleware.isLoggedIn, async (req, res) => {
  if (!req.user._id.equals(req.params.id)) {
    req.flash("error", "You can only edit your own profile.");
    return res.redirect(`/users/${req.user._id}`);
  }
  const user = req.user;
  const { firstName, screenName, bio, avatar, username } = req.body;
  if (screenName && screenName !== user.screenName) {
    const taken = await User.exists({ _id: { $ne: user._id }, screenName: new RegExp(`^${escapeRegex(screenName)}$`, "i") });
    if (taken) {
      req.flash("error", "That username is taken.");
      return res.redirect(`/users/${user._id}`);
    }
    user.screenName = screenName;
  }
  if (firstName) user.firstName = firstName;
  if (typeof bio === "string") user.bio = bio.slice(0, 500);
  if (avatar) user.avatar = avatar;

  let emailChanged = false;
  const newEmail = String(username || "").toLowerCase().trim();
  if (newEmail && newEmail !== user.username) {
    if (await User.exists({ username: newEmail })) {
      req.flash("error", "That email address is already in use.");
      return res.redirect(`/users/${user._id}`);
    }
    user.username = newEmail;
    user.verified = false;
    user.verificationToken = require("crypto").randomBytes(24).toString("hex");
    user.verificationExpires = Date.now() + 24 * 3600 * 1000;
    emailChanged = true;
  }
  await user.save();

  // Keep denormalized chef info on recipes in sync
  await Recipe.updateMany({ "chef.id": user._id }, { $set: { "chef.screenName": user.screenName, "chef.avatar": user.avatar } });

  if (emailChanged) {
    await require("../lib/mailer").sendVerificationEmail(req, user);
    req.flash("success", `Profile updated. Please check ${user.username} to verify your new email address.`);
  } else {
    req.flash("success", "Your profile has been updated.");
  }
  res.redirect(`/users/${user._id}`);
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
