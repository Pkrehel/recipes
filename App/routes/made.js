var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var User = require("../models/user");
var ObjectId = require('mongodb').ObjectID;

router.post("/", function(req, res) {
    //lookup recipe using ID
    Recipe.findById(req.params.id, function(err, recipe) {
        if (err) {
            console.log(err);
            res.redirect("back");
        }
        else {
            User.findByIdAndUpdate(req.user.id, {
                $pull: { 'toMakeRecipes': { '_id': ObjectId(recipe.id) } },
                $addToSet: { 'madeRecipes': recipe.id }
            }, function(err, user) {
                if (err) {
                    req.flash("error", "An Error Has Occurred. Could not add the recipe to your list.");
                    res.redirect("back");
                }
                user.save();
                req.flash('success', recipe.title, ' has been added to your made list!');
                res.redirect("/recipes/" + recipe.id);
            });
        }
    });
});

module.exports = router;
