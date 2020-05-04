var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var User = require("../models/user");
var middleware = require("../middleware");

router.post("/", middleware.isLoggedIn, function (req, res) {
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


// router.post("/", middleware.isLoggedIn, function (req, res) {
//    //lookup recipe using ID
//    Recipe.findByIdAndUpdate(req.params.id, { $addToSet: { 'lovedBy': { '_id': req.user.id } } }, function (err, recipe) {
//       if (err) {
//          req.flash('error', 'An error has occurred. ' + recipe.title + ' was not added to your favorites :(');
//          res.redirect("back");
//       }
//       else {
//          User.findOneAndUpdate(req.user.id, { $addToSet: { 'lovedRecipes': { "_id": recipe.id, "title": recipe.title, "image": recipe.image, "totalTime": recipe.totalTime } } },
//             function (err, user) {
//                if (err) {
//                   console.log(err);
//                   req.flash("error", "An Error Has Occurred. Please Try Again.");
//                   res.redirect("back");
//                }
//                else {
//                   user.save();
//                   req.flash("success", recipe.title + " was added to your favorites!");
//                   res.redirect("back");
//                }
//             });
//       }
//    });
// });

// router.delete("/", function (req, res) {
//    Recipe.findByIdAndUpdate(req.params.id, { $pull: { 'lovedBy': req.user.id } }, function (err, foundRecipe) {
//       if (err) {
//          req.flash("error", err.message);
//          return res.redirect("back");
//       }
//       User.findOneAndUpdate(req.user.id, { $pull: { 'lovedRecipes': { '_id': foundRecipe.id } } }).exec(function (err, foundUser) {
//          if (err) {
//             req.flash("error", err.message);
//             return res.redirect("back");
//          }
//          req.flash("success", foundRecipe.title + " was removed from your favorites.");
//          res.redirect("back");
//       });
//    });
// });

module.exports = router;
