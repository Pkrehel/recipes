require('dotenv').config();

var express = require("express"),
    router = express.Router(),
    passport = require("passport"),
    User = require("../models/user"),
    Recipe = require("../models/recipe"),
    randomstring = require("randomstring"),
    nodemailer = require('nodemailer');

//Show the home page
router.get("/", function (req, res) {

    //ON-SITE SEARCH BOX:
    var queryString = req.query.search;
    if (queryString) {
        var regex = new RegExp(escapeRegex(queryString), 'gi');
        Recipe.find({ $or: [{ "title": regex }, { "tags": regex }, { "category": regex }, { "ingredients": regex }] }).limit(12).exec(function (err, foundRecipe) {
            if (err) {
                console.log(err);
            }
            else {
                if (foundRecipe.length < 1) {
                    console.log("no results");
                    req.flash("error", "No results for \"" + queryString + "\". Please search again.");
                    res.redirect("/");
                }
                res.render("home", { foundRecipe: foundRecipe });
            }
        });
    }
    else {
        Recipe.find({}).sort({ createdAt: -1 }).limit(12).exec(function (err, latestRecipes) {
            if (err) {
                res.send(latestRecipes);
                // console.log(err);
            }
            else {
                res.render("home", { latestRecipes: latestRecipes });
            }
        });
    }
});

//===================
// USER REGISTRATION:
//===================

//Show the signup page
router.get("/register", function (req, res) {
    res.render("register", { message: req.flash("signupMessage") });
});

//REGISTER LOGIC:
router.post("/register", function (req, res) {
    var newUser = new User({
        username: req.body.username,
        screenName: req.body.screenName,
        avatar: req.body.avatar,

        // Randomstring Generation
        secretToken: randomstring.generate(),

        // Flag account as inactive
        active: false
    });
    User.register(newUser, req.body.password, function (err, user) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("register");
        }
        passport.authenticate("local")(req, res, function () {
            req.flash("success", "Your account is almost finsihed! Please check " + user.username + " to complete your account.");
            res.redirect("/verification-email");
        });
    });
});

// Send Verification Email After Account SignUp:
var mailOptions, host, link;

router.get("/verification-email", function (req, res) {
    host = req.get("host");
    // link = "http://" + req.get("host") + "/verify?id=" + req.user.secretToken;
    link = "https://palmer-krehel-palmerkrehel.c9users.io" + "/verify?id=" + req.user.secretToken;
    var smtpTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            type: 'OAuth2',
            clientId: '167699687567-5gtna23v1gv14hhb1239cceqkvdhfhm0.apps.googleusercontent.com',
            clientSecret: 'KwK-OfgN_4_MEzzesp2FqJVr',
            user: 'recipewebsitetest@gmail.com',
            refreshToken: '1/Z13y7DE8QRed5PLav1V6qEKZoxDIUxgx-mSyAPLkRlY',
            accessToken: 'ya29.Glv_BRD1R46qZFZBqcLzwLi-sfZGvSfY_5LUfD92PI9u0hWbdn3aegjasYbW-tkWdrdTUPI0t8FOqvDr_BwSBFNGc8BnuipwapSGJGiol8kNpgo2c3eyQVnSFgTW',
            expires: 1484314697598
        }
    });

    mailOptions = {
        from: "recipewebsitetest@gmail.com",
        to: req.user.username,
        subject: "Please Confirm Your Email Account",
        html: "Hello, <br> Please confirm your email by clicking the link below: <br><a href=" + link + ">Click here to verify your account.</a>",
    };
    console.log(mailOptions);
    smtpTransporter.sendMail(mailOptions, function (err, response) {
        if (err) {
            console.log("error with email transport");
            console.log(err);
            res.send(err);
        }
        else {
            console.log("message sent");
            req.flash("success", "A confirmation email has been sent to " + req.user.username + ". Please check your email to complete your account.");
            req.logout();
            res.redirect("/register");
        }
    });
});

router.get("/verify", function (req, res) {
    console.log(req.protocol + ":/" + req.get("host"));
    if ((req.protocol + "://" + req.get("host")) == ("http://" + host)) {
        console.log("Domain is matched. Information is from authentic email address");

        User.findOneAndUpdate(req.query.id, { $set: { active: true, secretToken: "" } }, function (err, user) {
            if (err) {
                req.flash("error", "An Error Has Occurred. Please Try Again.");
                res.redirect("/register");
            }
            else {
                user.save();
                req.flash("success", "Your email has been verified.");
                res.redirect("/");
            }
        });
    }
});
// End of email send / verification process


//handle login logic:
router.get("/login", function (req, res) {
    res.render("login");
});

router.post('/login',
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    })
);


// LOGOUT LOGIC
router.get("/logout", function (req, res) {
    req.logout();
    req.flash("success", "You have been successfully logged out.");
    res.redirect("/");
});

//USER PUBLIC PROFILE ROUTES:
router.get("/users/:id", function (req, res) {
    User.findById(req.params.id, function (err, foundUser) {
        if (err) {
            req.flash("error", "Cannot Find User's Profile");
            res.redirect("/");
        }
        res.render("users/public", { user: foundUser });
    });
});

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
