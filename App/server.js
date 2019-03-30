require('dotenv').config();

var express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    flash = require("connect-flash"),
    passport = require("passport"),
    LocalStrategy = require('passport-local').Strategy,
    methodOverride = require("method-override"),
    User = require("./models/user");

//requiring routes
var commentRoutes = require("./routes/comments"),
    recipeRoutes = require("./routes/recipes"),
    indexRoutes = require("./routes/index"),
    reviewRoutes = require("./routes/reviews"),
    loveRecipeRoutes = require("./routes/love"),
    categoryRoutes = require("./routes/categories");

mongoose.connect("mongodb://localhost/db_1");
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

//passport configuration
app.use(require("express-session")({
    secret: process.env.PASSPORT_SECRET,
    resave: false,
    saveUninitialized: false
}));

app.locals.moment = require("moment");

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    res.locals.searchQuery = req.query.search;
    next();
});

app.use("/", indexRoutes);
app.use("/recipes", recipeRoutes);
app.use("/recipes/:id/comments", commentRoutes);
app.use("/recipes/:id/love", loveRecipeRoutes);
app.use("/recipes/:id/reviews", reviewRoutes);
app.use("/categories", categoryRoutes);

app.listen(process.env.PORT, process.env.IP, function () {
    console.log("The Server Has Started!");
});
