var Recipe = require("../models/recipe.js"),
    Comment = require("../models/comment.js"),
    User = require("../models/user.js");

var middlewareObj = {};

middlewareObj.isLoggedIn = function(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("/login");
};



middlewareObj.checkRecipeOwnership = function(req, res, next) {
    // is the user logged in?
    if (req.isAuthenticated()) {
        Recipe.findById(req.params.id, function(err, foundRecipe) {
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


middlewareObj.checkCommentOwnership = function(req, res, next) {
    // is the user logged in?
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, function(err, foundComment) {
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

module.exports = middlewareObj;
