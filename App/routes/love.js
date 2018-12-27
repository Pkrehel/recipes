var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var User = require("../models/user");

//Favorite Post
router.post("/", function (req, res) {
   //lookup recipe using ID
   Recipe.findByIdAndUpdate(req.params.id, { $addToSet: { 'lovedBy': { '_id': req.user.id } } }, function (err, recipe) {
      if (err) {
         req.flash('error', 'An error has occurred. ' + recipe.title + ' was not added to your favorites.');
         res.redirect("back");
      }
      else {
         User.findOneAndUpdate(req.user.id, { $addToSet: { 'lovedRecipes': { "_id": recipe.id, "title": recipe.title, "image": recipe.image, "allergens": recipe.allergens } } },
            function (err, user) {
               if (err) {
                  console.log(err);
                  req.flash("error", "An Error Has Occurred. Please Try Again.");
                  res.redirect("back");
               }
               else {
                  user.save();
                  req.flash("success", recipe.title + "was added to your favorites!");
                  res.redirect("back");
               }
            });
      }
   });
});

module.exports = router;
