/**
 * SEO helpers: slugs, structured data (JSON-LD), meta tag construction, image URLs.
 * Everything here is pure (no DB access) so it is easy to test.
 */

const SITE = {
  name: process.env.SITE_NAME || "Flippin' Good Recipes",
  tagline: "Create, share, search and save your favorite recipes.",
  url: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  locale: "en_US",
  twitter: process.env.TWITTER_HANDLE || "",
  defaultImage: process.env.DEFAULT_OG_IMAGE || ""
};

function slugify(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sanitized HTML -> plain text suitable for a <textarea>, keeping paragraph breaks. */
function htmlToText(html) {
  return String(html || "")
    .replace(/\s*<\/(p|div|h[1-6]|li|blockquote)>\s*/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Plain text (blank line = paragraph) -> simple HTML. Input that already contains tags is returned as-is. */
function textToHtml(text) {
  const t = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!t) return "";
  if (/<[a-z][^>]*>/i.test(t)) return t;
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function truncate(text, max = 155) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trim() + "…";
}

/** minutes -> ISO 8601 duration, e.g. 90 -> PT1H30M */
function isoDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m === 0) return "PT0M";
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return "PT" + (h ? `${h}H` : "") + (rem || !h ? `${rem}M` : "");
}

const DIET_MAP = {
  "Gluten-Free": "https://schema.org/GlutenFreeDiet",
  Vegetarian: "https://schema.org/VegetarianDiet",
  Vegan: "https://schema.org/VeganDiet"
  // Dairy-Free and Nut-Free have no schema.org RestrictedDiet enum; they go into keywords instead.
};

/**
 * Cloudinary delivery URL with automatic format/quality and an optional width.
 * Non-Cloudinary URLs are returned unchanged.
 */
function imageUrl(url, { width, height, crop = "fill" } = {}) {
  if (!url || !/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) return url;
  const parts = ["f_auto", "q_auto"];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push(`c_${crop}`, "g_auto");
  return url.replace("/image/upload/", `/image/upload/${parts.join(",")}/`);
}

function absolute(path) {
  if (!path) return SITE.url;
  if (/^https?:\/\//.test(path)) return path;
  return SITE.url + (path.startsWith("/") ? path : "/" + path);
}

function recipeJsonLd(recipe, reviews = []) {
  const keywords = [...(recipe.tags || []), ...(recipe.allergens || []).filter((a) => !DIET_MAP[a]), recipe.cuisine]
    .filter(Boolean)
    .join(", ");

  const data = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "@id": absolute(`/recipes/${recipe.slug}`) + "#recipe",
    mainEntityOfPage: absolute(`/recipes/${recipe.slug}`),
    name: recipe.title,
    image: [imageUrl(recipe.image, { width: 1200, height: 1200 }), imageUrl(recipe.image, { width: 1200, height: 900 }), imageUrl(recipe.image, { width: 1200, height: 675 })],
    description: recipe.summary || truncate(stripHtml(recipe.description), 300),
    author: {
      "@type": "Person",
      name: recipe.chef?.screenName || SITE.name,
      url: recipe.chef?.id ? absolute(`/users/${recipe.chef.id}`) : undefined
    },
    datePublished: recipe.createdAt ? new Date(recipe.createdAt).toISOString() : undefined,
    dateModified: recipe.updatedAt ? new Date(recipe.updatedAt).toISOString() : undefined,
    prepTime: isoDuration(recipe.prepTime),
    cookTime: isoDuration(recipe.cookTime),
    totalTime: isoDuration(recipe.totalTime || Number(recipe.prepTime || 0) + Number(recipe.cookTime || 0)),
    recipeYield: recipe.servings ? `${recipe.servings} servings` : undefined,
    recipeCategory: recipe.category,
    recipeCuisine: recipe.cuisine || undefined,
    keywords: keywords || undefined,
    suitableForDiet: (recipe.allergens || []).map((a) => DIET_MAP[a]).filter(Boolean),
    recipeIngredient: recipe.ingredients,
    recipeInstructions: (recipe.directions || []).map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: `Step ${i + 1}`,
      text: step,
      url: absolute(`/recipes/${recipe.slug}#step-${i + 1}`)
    })),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: (recipe.lovedBy || []).length },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: (recipe.comments || []).length }
    ]
  };

  const rated = reviews.filter((r) => r && r.rating);
  if (rated.length > 0) {
    const avg = rated.reduce((s, r) => s + r.rating, 0) / rated.length;
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Math.round(avg * 10) / 10,
      ratingCount: rated.length,
      reviewCount: rated.filter((r) => r.text).length || rated.length,
      bestRating: 5,
      worstRating: 1
    };
    data.review = rated.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author?.screenName || "Anonymous" },
      datePublished: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
      reviewBody: r.text || undefined,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 }
    }));
  }

  if (!data.suitableForDiet.length) delete data.suitableForDiet;
  return prune(data);
}

function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absolute(it.url)
    }))
  };
}

function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": SITE.url + "/#organization",
        name: SITE.name,
        url: SITE.url,
        logo: SITE.defaultImage || undefined
      },
      {
        "@type": "WebSite",
        "@id": SITE.url + "/#website",
        name: SITE.name,
        url: SITE.url,
        description: SITE.tagline,
        publisher: { "@id": SITE.url + "/#organization" },
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: SITE.url + "/s?search={search_term_string}" },
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };
}

/** ItemList of recipes for listing pages (home, category, search). */
function itemListJsonLd(recipes, { name, url }) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absolute(url),
    numberOfItems: recipes.length,
    itemListElement: recipes.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absolute(`/recipes/${r.slug}`),
      name: r.title
    }))
  };
}

function profileJsonLd(user) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: user.screenName,
      description: user.bio || undefined,
      url: absolute(`/users/${user._id}`)
    }
  };
}

/** Remove undefined / empty-array / empty-string values recursively. */
function prune(obj) {
  if (Array.isArray(obj)) return obj.map(prune).filter((v) => v !== undefined);
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const p = prune(v);
      if (p === undefined || p === "" || (Array.isArray(p) && p.length === 0)) continue;
      out[k] = p;
    }
    return out;
  }
  return obj;
}

/** Serialize JSON-LD safely for embedding inside a <script> tag. */
function jsonLdScript(data) {
  return JSON.stringify(prune(data)).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");
}

/**
 * Build the `meta` object every view expects. Any field can be overridden per route.
 */
function buildMeta(req, overrides = {}) {
  const path = req.baseUrl + req.path;
  const canonicalPath = overrides.canonical !== undefined ? overrides.canonical : path;
  const title = overrides.title ? `${overrides.title} | ${SITE.name}` : `${SITE.name}: ${SITE.tagline}`;
  return {
    site: SITE,
    title,
    rawTitle: overrides.title || SITE.name,
    description: truncate(overrides.description || SITE.tagline, 160),
    canonical: canonicalPath === null ? null : absolute(canonicalPath),
    robots: overrides.robots || "index,follow,max-image-preview:large",
    ogType: overrides.ogType || "website",
    image: overrides.image ? imageUrl(overrides.image, { width: 1200, height: 630 }) : SITE.defaultImage || null,
    imageAlt: overrides.imageAlt || overrides.title || SITE.name,
    jsonLd: (overrides.jsonLd || []).map(jsonLdScript),
    prev: overrides.prev ? absolute(overrides.prev) : null,
    next: overrides.next ? absolute(overrides.next) : null,
    publishedTime: overrides.publishedTime || null,
    modifiedTime: overrides.modifiedTime || null
  };
}

module.exports = {
  SITE,
  slugify,
  stripHtml,
  htmlToText,
  textToHtml,
  escapeHtml,
  truncate,
  isoDuration,
  imageUrl,
  absolute,
  recipeJsonLd,
  breadcrumbJsonLd,
  websiteJsonLd,
  itemListJsonLd,
  profileJsonLd,
  jsonLdScript,
  buildMeta
};
