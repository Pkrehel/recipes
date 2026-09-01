require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const methodOverride = require("method-override");
const compression = require("compression");
const helmet = require("helmet");

const User = require("./models/user");
const middleware = require("./middleware");
const seo = require("./lib/seo");

const app = express();
const isProd = process.env.NODE_ENV === "production";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1); // Render / most PaaS terminate TLS at a proxy
app.disable("x-powered-by");

// ---------- Security & performance ----------
app.use(
  helmet({
    contentSecurityPolicy: false, // templates use inline scripts + several CDNs; tighten later if desired
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);
app.use(compression());

// Force HTTPS + canonical host in production (SEO: one URL per page).
app.use((req, res, next) => {
  if (!isProd) return next();
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const canonicalHost = process.env.CANONICAL_HOST; // e.g. www.example.com
  const host = req.get("host");
  if (proto !== "https" || (canonicalHost && host !== canonicalHost)) {
    return res.redirect(301, `https://${canonicalHost || host}${req.originalUrl}`);
  }
  next();
});

app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "100kb" }));
app.use(methodOverride("_method"));
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: isProd ? "7d" : 0,
    etag: true
  })
);

// ---------- Sessions ----------
const sessionSecret = process.env.SESSION_SECRET || process.env.PASSPORT_SECRET;
if (!sessionSecret && isProd) throw new Error("SESSION_SECRET is required in production");
app.use(
  session({
    name: "fgr.sid",
    secret: sessionSecret || "dev-only-secret",
    resave: false,
    saveUninitialized: false,
    store: process.env.NODE_ENV === "test" ? undefined : MongoStore.create({ client: mongoose.connection.getClient(), touchAfter: 24 * 3600, autoRemove: process.env.SESSION_STORE_AUTO_REMOVE || "native" }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000
    }
  })
);
app.use(flash());

// ---------- Auth ----------
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy({ usernameField: "username" }, User.authenticate()));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).populate("lovedRecipes", "title slug image totalTime");
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

app.use(middleware.globalRateLimit);

// ---------- Template locals ----------
app.locals.seo = seo;
app.locals.formatDate = (d) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
app.locals.gtmId = process.env.GTM_ID || "";
app.locals.categories = require("./models/recipe").CATEGORIES;
app.locals.diets = require("./models/recipe").DIETS;

app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  res.locals.searchQuery = req.query.search || "";
  res.locals.currentPath = req.path;
  res.locals.buildMeta = (overrides) => seo.buildMeta(req, overrides);
  res.locals.meta = seo.buildMeta(req); // default; routes override via res.render(..., { meta })
  next();
});

// ---------- Routes ----------
app.use("/", require("./routes/seo"));
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/index"));
app.use("/recipes", require("./routes/recipes"));
app.use("/recipes/:id/comments", require("./routes/comments"));
app.use("/recipes/:id/love", require("./routes/love"));
app.use("/recipes/:id/reviews", require("./routes/reviews"));
app.use("/api", require("./routes/api"));

// 404
app.use((req, res) => {
  res.status(404).render("errors/404", { meta: res.locals.buildMeta({ title: "Page not found", robots: "noindex" }) });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    req.flash("error", "That image is too large. Please upload an image under 8 MB.");
    return middleware.back(req, res);
  }
  if (err.message && /images are allowed/.test(err.message)) {
    req.flash("error", err.message);
    return middleware.back(req, res);
  }
  if (err.name === "ValidationError" || err.code === 11000) {
    const msg = err.code === 11000 ? "That value is already taken." : Object.values(err.errors).map((e) => e.message).join(" ");
    req.flash("error", msg);
    return middleware.back(req, res);
  }
  console.error(err);
  res.status(err.status || 500).render("errors/500", {
    meta: res.locals.buildMeta({ title: "Something went wrong", robots: "noindex" }),
    message: isProd ? null : err.message
  });
});

module.exports = app;
