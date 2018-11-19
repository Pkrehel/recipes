var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var User = require("../models/user");

router.post("/", function(req, res) {
   //lookup recipe using ID
   Recipe.findById(req.params.id, function(err, recipe) {
      if (err) {
         console.log(err);
         res.redirect("back");
      }
      else {
         User.findOneAndUpdate(req.user.id, { $addToSet: { toMakeRecipes: recipe } }, function(err, user) {
            if (err) {
               req.flash("error", "An Error Has Occurred. Could not add the recipe to your list.");
               res.redirect("back");
            }
            else {
               user.save();
               req.flash('success', recipe.title, ' has been added to your recipe book!');
               res.redirect("back");
            }
         });
      }
   });
});

module.exports = router;
