var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var middleware = require("../middleware");
var Review = require("../models/review");

//Review Create
router.post("/", middleware.socialRateLimits, middleware.isLoggedIn, middleware.checkReviewExistence, function (req, res) {
    //lookup recipe using ID
    Recipe.findById(req.params.id).populate("reviews").exec(function (err, recipe) {
        if (err) {
            console.log(err);
            res.redirect("/recipes");
        }
        else {
            Review.create(req.body.review, function (err, review) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                //add author username/id and associated recipe to the review
                review.author.id = req.user._id;
                review.author.screenName = req.user.screenName;
                review.recipe = recipe;
                //save review
                review.save();
                recipe.reviews.push(review);
                // calculate the new average review for the recipe
                recipe.rating = calculateAverage(recipe.reviews);
                //save recipe
                recipe.save();
                req.flash("success", "Your review has been successfully added.");
                res.redirect('/recipes/' + recipe._id);
            });
        }
    });
});

// Reviews Delete
router.delete("/:review_id", middleware.checkCommentOwnership, middleware.socialRateLimits, middleware.isLoggedIn, middleware.checkReviewExistence, function (req, res) {
    Review.findByIdAndRemove(req.params.review_id, function (err) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        Recipe.findByIdAndUpdate(req.params.id, { $pull: { 'reviews': { '_id': req.params.review_id } } }, { new: true }).populate("reviews").exec(function (err, recipe) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            // recalculate recipe average
            recipe.rating = calculateAverage(recipe.reviews);
            //save changes
            recipe.save();
            req.flash("success", "Your review was deleted successfully.");
            res.redirect("/recipes/" + req.params.id);
        });
    });
});


function calculateAverage(reviews) {
    if (reviews.length === 0) {
        return 0;
        console.log("zero length!");
    }
    var sum = 0;
    reviews.forEach(function (element) {
        sum += element.rating;
    });
    return sum / reviews.length;
}

module.exports = router;
