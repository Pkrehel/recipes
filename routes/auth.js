const express = require("express");
const crypto = require("crypto");
const passport = require("passport");
const User = require("../models/user");
const middleware = require("../middleware");
const mailer = require("../lib/mailer");

const router = express.Router();
const AVATARS = ["😛", "😎", "🍉", "🌶", "🍅", "🍍", "🍄", "🍲", "☕", "🍜", "🍷", "🍳"];
const token = () => crypto.randomBytes(24).toString("hex");
const noindex = (title) => ({ title, robots: "noindex,nofollow" });

function safeReturnTo(req) {
  const to = req.session.returnTo;
  delete req.session.returnTo;
  return to && to.startsWith("/") && !to.startsWith("//") ? to : "/";
}

// ---------- Register ----------
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/");
  res.render("register", { meta: res.locals.buildMeta(noindex("Create an account")), avatars: AVATARS });
});

router.post("/register", middleware.accountRateLimit, async (req, res, next) => {
  const { username, screenName, firstName, avatar, password } = req.body;
  if (!password || password.length < 8) {
    req.flash("error", "Password must be at least 8 characters.");
    return res.redirect("/register");
  }
  if (!/^\S+@\S+\.\S+$/.test(username || "")) {
    req.flash("error", "Please enter a valid email address.");
    return res.redirect("/register");
  }
  if (await User.exists({ screenName: new RegExp(`^${escapeRegex(screenName || "")}$`, "i") })) {
    req.flash("error", "That username is taken. Please choose another.");
    return res.redirect("/register");
  }

  const user = new User({
    username,
    screenName,
    firstName,
    avatar: AVATARS.includes(avatar) ? avatar : "🍳",
    verified: false,
    verificationToken: token(),
    verificationExpires: Date.now() + 24 * 3600 * 1000
  });

  try {
    await User.register(user, password);
  } catch (err) {
    req.flash("error", err.message);
    return res.redirect("/register");
  }

  req.login(user, async (err) => {
    if (err) return next(err);
    try {
      await mailer.sendVerificationEmail(req, user);
      req.flash("success", `Welcome, ${user.firstName}! We sent a verification link to ${user.username}. Please confirm your email before posting recipes.`);
    } catch (mailErr) {
      console.error("verification email failed", mailErr);
      req.flash("error", "Your account was created, but we couldn't send the verification email. You can request a new one from your profile.");
    }
    res.redirect(`/users/${user._id}`);
  });
});

// ---------- Email verification ----------
router.get("/verify/:token", middleware.accountRateLimit, async (req, res) => {
  const user = await User.findOne({ verificationToken: req.params.token, verificationExpires: { $gt: Date.now() } });
  if (!user) {
    req.flash("error", "That verification link is invalid or has expired. Log in and request a new one from your profile.");
    return res.redirect("/login");
  }
  user.verified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  await user.save();
  req.flash("success", "Your email has been verified. You can now share recipes!");
  res.redirect(req.isAuthenticated() ? "/recipes/new" : "/login");
});

router.post("/verify/resend", middleware.accountRateLimit, middleware.isLoggedIn, async (req, res) => {
  if (req.user.verified) {
    req.flash("success", "Your email is already verified.");
    return res.redirect(`/users/${req.user._id}`);
  }
  req.user.verificationToken = token();
  req.user.verificationExpires = Date.now() + 24 * 3600 * 1000;
  await req.user.save();
  await mailer.sendVerificationEmail(req, req.user);
  req.flash("success", `A new verification link was sent to ${req.user.username}.`);
  res.redirect(`/users/${req.user._id}`);
});

// ---------- Login / logout ----------
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/");
  res.render("login", { meta: res.locals.buildMeta(noindex("Log in")) });
});

router.post("/login", middleware.accountRateLimit, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash("error", (info && info.message) || "Incorrect email or password.");
      return res.redirect("/login");
    }
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      req.flash("success", `Welcome back, ${user.firstName}!`);
      res.redirect(safeReturnTo(req));
    });
  })(req, res, next);
});

router.post("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("fgr.sid");
      res.redirect("/");
    });
  });
});
// Convenience for old links
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect("/"));
  });
});

// ---------- Forgot / reset password ----------
router.get("/forgot", (req, res) => {
  res.render("forgot", { meta: res.locals.buildMeta(noindex("Forgot password")) });
});

router.post("/forgot", middleware.accountRateLimit, async (req, res) => {
  const user = await User.findOne({ username: String(req.body.email || "").toLowerCase().trim() });
  // Always respond the same way so the form can't be used to enumerate accounts.
  if (user) {
    user.resetPasswordToken = token();
    user.resetPasswordExpires = Date.now() + 3600 * 1000;
    await user.save();
    try {
      await mailer.sendPasswordResetEmail(req, user);
    } catch (err) {
      console.error("reset email failed", err);
    }
  }
  req.flash("success", "If an account exists for that email, we've sent password reset instructions.");
  res.redirect("/forgot");
});

router.get("/reset/:token", middleware.accountRateLimit, async (req, res) => {
  const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) {
    req.flash("error", "Password reset link is invalid or has expired.");
    return res.redirect("/forgot");
  }
  res.render("reset", { meta: res.locals.buildMeta(noindex("Choose a new password")), token: req.params.token });
});

router.post("/reset/:token", middleware.accountRateLimit, async (req, res, next) => {
  const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
  if (!user) {
    req.flash("error", "Password reset link is invalid or has expired.");
    return res.redirect("/forgot");
  }
  if (!req.body.password || req.body.password.length < 8) {
    req.flash("error", "Password must be at least 8 characters.");
    return res.redirect(`/reset/${req.params.token}`);
  }
  if (req.body.password !== req.body.confirm) {
    req.flash("error", "Passwords do not match.");
    return res.redirect(`/reset/${req.params.token}`);
  }
  await user.setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  mailer.sendPasswordChangedEmail(user).catch((e) => console.error("password changed email failed", e));
  req.login(user, (err) => {
    if (err) return next(err);
    req.flash("success", "Your password has been changed.");
    res.redirect("/");
  });
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
