var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var User = require("../models/user");
var middleware = require("../middleware");

router.post("/", middleware.socialRateLimits, middleware.isLoggedIn, function (req, res) {
   // Update the recipe like
    Recipe.findById(req.params.id, function (err, foundRecipe) {
        if (err) {
            console.log(err);
            return res.redirect("/");
        }

        // check if req.user._id exists in foundRecipe.likes
        var foundUserLike = foundRecipe.lovedBy.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundRecipe.lovedBy.pull(req.user._id);
        } else {
            // adding the new user like
            foundRecipe.lovedBy.push(req.user._id);
        }

        foundRecipe.save(function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/");
            }
        });
      // Update the user 
        User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err);
            return res.redirect("/");
        }

        // check if req.user._id exists in foundRecipe.likes
        var foundRecipeLike = foundUser.lovedRecipes.some(function (like) {
            return like.equals(foundRecipe._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundUser.lovedRecipes.pull(foundRecipe._id);
           foundUser.save(function (err) {
               if (err) {
                   console.log(err);
                   return res.redirect("/");
               }
               req.flash("success", foundRecipe.title + " was removed from your favorites!");
               res.redirect("back");
           });
        } else {
            // adding the new user like
         foundUser.lovedRecipes.push(foundRecipe._id);
           foundUser.save(function (err) {
               if (err) {
                   console.log(err);
                   return res.redirect("/");
               }
               req.flash("success", foundRecipe.title + " was added to your favorites!");
               res.redirect("/recipes/"+ foundRecipe._id);
           });
        }
    });
    });
});

module.exports = router;
