require('dotenv').config();

var express = require("express"),
    app = express(),
    router = express.Router(),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    flash = require("connect-flash"),
    passport = require("passport"),
    LocalStrategy = require('passport-local'),
    methodOverride = require("method-override"),
    session = require("express-session"),
    rateLimit = require("express-rate-limit"),
    MongoStore = require('rate-limit-mongo'),
    compression = require('compression'),
    // enforce = require('express-sslify'),
    User = require("./models/user");

//requiring routes
var commentRoutes = require("./routes/comments"),
    recipeRoutes = require("./routes/recipes"),
    indexRoutes = require("./routes/index"),
    reviewRoutes = require("./routes/reviews"),
    loveRecipeRoutes = require("./routes/love"),
    apiRoutes = require("./routes/api");

var databaseUri = process.env.MONGODB_URI || "mongodb://localhost/db_1";

mongoose.connect( databaseUri, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true })
     .then(() => console.log( 'Database Connected' ))
     .catch(err => console.log( err ));

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());
app.use(compression());
// app.use(enforce.HTTPS({ trustProtoHeader: true }));

//passport configuration
app.use(require("express-session")({
    secret: process.env.PASSPORT_SECRET,
    resave: false,
    saveUninitialized: false
}));

// global rate limiter - applies to all requests
var globalRateLimit = rateLimit({
    store: new MongoStore({
        uri: process.env.MONGODB_URI || "mongodb://localhost/db_1",
        collectionName: "globalRateLimit"
  }),
    windowMs: 1 * 60 * 1000, //1 minute
    max: 100, // Limit each IP to x requests per window
    message: "You've exceeded the number of requests you are able to make in a certain time window. Please try again in 1 minute."
});
app.use(globalRateLimit);

app.locals.moment = require("moment");

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

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
app.use("/api", apiRoutes);

app.listen(process.env.PORT || 3000, process.env.IP, function () {
    console.log("The Server Has Started!");
});
