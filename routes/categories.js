var express = require("express"),
    router = express.Router(),
    Recipe = require("../models/recipe");

router.get("/:category", function(req, res){
    var perPage = 6;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    var recipeCategory = req.params.category;
    console.log(recipeCategory);
    Recipe.find({ $or: [{ "title": recipeCategory }, { "tags": recipeCategory }, { "category": recipeCategory }, { "ingredients": recipeCategory }, { "directions": recipeCategory }, { "description": recipeCategory }, { "allergens": recipeCategory }] }).skip((perPage * pageNumber) - perPage).limit(perPage).sort({ createdAt: -1 }).exec(function (err, foundRecipe) {
        Recipe.count({ $or: [{ "title": recipeCategory }, { "tags": recipeCategory }, { "category": recipeCategory }, { "ingredients": recipeCategory }, { "directions": recipeCategory }, { "description": recipeCategory }, { "allergens": recipeCategory }] }).exec(function (err, count) {
            if (err) {
                req.flash("error", "Sorry, an error has occurred.");
                res.redirect("back");
            } 
            else {
                if (foundRecipe.length == 0 || recipeCategory.length == 0) {
                    req.flash("error", "No results for \"" + recipeCategory + "\". Please update your search and try again.");
                    res.redirect("back");
                }
                else {
                    if (req.user) {
                        User.findByIdAndUpdate(req.user.id, { $push: { 'searches': recipeCategory } }, function (err, foundUser) {
                            if (err) {
                                req.flash("error", "An Error Occurred. Please search again.");
                                res.redirect("back");
                            }
                            else {
                                foundUser.save();
                                res.render("categories", {
                                    foundRecipe: foundRecipe,
                                    current: pageNumber,
                                    pages: Math.ceil(count / perPage),
                                    noMatch: noMatch,
                                    category: recipeCategory,
                                    perPage: perPage
                                });
                            }
                        });
                    } 
                    else {
                        res.render("categories", {
                            foundRecipe: foundRecipe,
                            current: pageNumber,
                            pages: Math.ceil(count / perPage),
                            noMatch: noMatch,
                            category: recipeCategory,
                            perPage: perPage
                        });                    
                    }
                }
            }
        });
    });
});

module.exports = router;
