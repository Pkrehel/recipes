const express = require("express");
const Recipe = require("../models/recipe");
const User = require("../models/user");
const seo = require("../lib/seo");

const router = express.Router();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

router.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /s",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /forgot",
      "Disallow: /reset/",
      "Disallow: /verify/",
      "Disallow: /recipes/new",
      "Disallow: /*/edit$",
      "Disallow: /api/",
      "",
      `Sitemap: ${seo.SITE.url}/sitemap.xml`,
      ""
    ].join("\n")
  );
});

router.get("/sitemap.xml", async (req, res) => {
  const { COLLECTIONS } = require("./index");
  const [recipes, chefs] = await Promise.all([
    Recipe.find({}).select("slug updatedAt image title").sort("-updatedAt").limit(45000).lean(),
    User.find({ recipes: { $exists: true, $not: { $size: 0 } } }).select("_id updatedAt").lean()
  ]);
  const urls = [];
  const add = (loc, { lastmod, changefreq, priority, image } = {}) =>
    urls.push(
      `<url><loc>${esc(seo.absolute(loc))}</loc>` +
        (lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : "") +
        (changefreq ? `<changefreq>${changefreq}</changefreq>` : "") +
        (priority ? `<priority>${priority}</priority>` : "") +
        (image ? `<image:image><image:loc>${esc(seo.imageUrl(image.url, { width: 1200 }))}</image:loc><image:title>${esc(image.title)}</image:title></image:image>` : "") +
        `</url>`
    );

  add("/", { changefreq: "daily", priority: "1.0", lastmod: recipes[0]?.updatedAt });
  add("/about", { changefreq: "yearly", priority: "0.3" });
  Object.keys(COLLECTIONS).forEach((c) => add(`/recipes/collections/${c}`, { changefreq: "weekly", priority: "0.7" }));
  recipes.forEach((r) => add(`/recipes/${r.slug}`, { lastmod: r.updatedAt, changefreq: "monthly", priority: "0.8", image: { url: r.image, title: r.title } }));
  chefs.forEach((u) => add(`/users/${u._id}`, { lastmod: u.updatedAt, changefreq: "monthly", priority: "0.4" }));

  res.set("Cache-Control", "public, max-age=3600");
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>`
  );
});

// Plain-language description of the site for AI crawlers / answer engines (GEO).
router.get("/llms.txt", async (req, res) => {
  const recipes = await Recipe.find({}).select("slug title summary").sort("-createdAt").limit(200).lean();
  const lines = [
    `# ${seo.SITE.name}`,
    "",
    `> ${seo.SITE.tagline} A community recipe site where home cooks publish recipes with ingredients, step-by-step directions, prep/cook times, dietary tags and star-rated reviews. Every recipe page includes schema.org Recipe JSON-LD.`,
    "",
    "## Machine-readable access",
    `- JSON API (read-only): ${seo.SITE.url}/api/v1/recipes and ${seo.SITE.url}/api/v1/recipes/{slug}`,
    `- Sitemap: ${seo.SITE.url}/sitemap.xml`,
    "",
    "## Recipes",
    ...recipes.map((r) => `- [${r.title}](${seo.absolute(`/recipes/${r.slug}`)})${r.summary ? `: ${r.summary}` : ""}`)
  ];
  res.type("text/plain").send(lines.join("\n") + "\n");
});

router.get("/about", (req, res) => {
  res.render("about", {
    meta: res.locals.buildMeta({
      title: `About ${seo.SITE.name}`,
      description: `${seo.SITE.name} is a free community recipe site. Learn how recipes, reviews and favorites work and how to share your own.`,
      jsonLd: [seo.websiteJsonLd()]
    })
  });
});

router.get("/healthz", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

module.exports = router;
