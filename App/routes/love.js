var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var User = require("../models/user");

//Favorite Post
router.post("/", function (req, res) {
   //lookup recipe using ID
   Recipe.findByIdAndUpdate(req.params.id, {
      $addToSet: { 'lovedBy': req.user.id }
   }, function (err, recipe) {
      if (err) {
         console.log(err);
         res.redirect("back");
      }
      else {
         recipe.save();
         User.findByIdAndUpdate(req.user.id, {
            $addToSet: { 'lovedRecipes': recipe._id }
         }, function (err, foundUser) {
            if (err) {
               console.log(err);
               req.flash('error', 'An error has occurred. ' + recipe.title + ' was not added to your favorites.');
               res.redirect("back");
            }
            else {
               foundUser.save();
               req.flash('success', recipe.title, ' has been added to your favorites!');
               res.redirect('/recipes/' + recipe._id);
            }
         });
      }
   });
});

module.exports = router;
