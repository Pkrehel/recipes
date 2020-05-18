var Recipe = require("../models/recipe.js"),
    Comment = require("../models/comment.js"),
    Review = require("../models/review.js"),
    rateLimit = require("express-rate-limit"),
    MongoStore = require('rate-limit-mongo');

var middlewareObj = {};

middlewareObj.isLoggedIn = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("/login");
};



middlewareObj.checkRecipeOwnership = function (req, res, next) {
    // is the user logged in?
    if (req.isAuthenticated()) {
        Recipe.findById(req.params.id, function (err, foundRecipe) {
            if (err || !foundRecipe) {
                req.flash("error", "Recipe Not Found. This may have been deleted from the original chef.");
                res.redirect("back");
            }
            else {
                // does the user own the recipe?
                if (foundRecipe.chef.id.equals(req.user.id)) {
                    next();
                }
                else {
                    req.flash("error", "You don't have permission to do that!");
                    res.redirect("back");
                }
            }
        });
    }
    else {
        req.flash("error", "You need to be logged in to do that!");
        res.redirect("back");
    }
};


middlewareObj.checkCommentOwnership = function (req, res, next) {
    // is the user logged in?
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, function (err, foundComment) {
            if (err || !foundComment) {
                req.flash("error", "Comment not found!");
                res.redirect("back");
            }
            else {
                // does the user own the comment?
                if (foundComment.author.id.equals(req.user.id)) {
                    next();
                }
                else {
                    req.flash("error", "You don't have permission to do that!");
                    res.redirect("back");
                }
            }
        });
    }
    else {
        res.redirect("back");
    }
};


middlewareObj.checkReviewOwnership = function (req, res, next) {
    if (req.isAuthenticated()) {
        Review.findById(req.params.review_id, function (err, foundReview) {
            if (err || !foundReview) {
                res.redirect("back");
            }
            else {
                // does user own the comment?
                if (foundReview.author.id.equals(req.user._id)) {
                    next();
                }
                else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    }
    else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistence = function (req, res, next) {
    if (req.isAuthenticated()) {
        Recipe.findById(req.params.id).populate("reviews").exec(function (err, foundRecipe) {
            if (err || !foundRecipe) {
                req.flash("error", "Recipe not found.");
                res.redirect("back");
            }
            else {
                // check if req.user._id exists in foundRecipe.reviews
                var foundUserReview = foundRecipe.reviews.some(function (review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review.");
                    return res.redirect("/recipes/" + foundRecipe._id);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    }
    else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};


// RATE LIMITING:
// Account related rate limits
// applies to logins, account creations, forgot my password, profile updates
middlewareObj.accountRateLimit = rateLimit({
    store: new MongoStore({
        uri: "mongodb://localhost/db_1",
        collectionName: "accountRateLimit"
  }),
    windowMs: 10 * 60 * 1000, //10 minutes
    max: 15, // Limit each IP to 10 requests per time window
    message: "You've exceeded the number of requests you are able to make. Please try again in a few minutes.",
});


// Recipe related rate limits
// applies to creating a new recipe, or updating an exisiting recipe
middlewareObj.recipeRateLimits = rateLimit({
    store: new MongoStore({
        uri: "mongodb://localhost/db_1",
        collectionName: "recipeRateLimits"
  }),
    windowMs: 10 * 60 * 1000, //10 minutes
    max: 10, // Limit each IP to 15 requests per time window
    message: "You've exceeded the number of requests you are able to make. Please try again in a few minutes.",
});

// Social rate limits
// applies to liking and commenting on recipes
middlewareObj.socialRateLimits = rateLimit({
    store: new MongoStore({
        uri: "mongodb://localhost/db_1",
        collectionName: "socialRateLimits"
  }),
    windowMs: 1 * 60 * 1000, //10 minutes
    max: 35, // Limit each IP to 35 requests per time window
    message: "You've exceeded the number of requests you are able to make. Please try again in a few minutes.",
});


module.exports = middlewareObj;
