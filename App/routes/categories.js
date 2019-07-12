var express = require("express"),
    router = express.Router(),
    Recipe = require("../models/recipe");

//Show the home page
router.get("/:category", function (req, res) {
    var category = req.params.category;
    var perPage = 6;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    Recipe.find({ 
        $or: [{ "title": category }, 
        { "allergens": category }, 
        { "tags": category }, 
        { "category": category }, 
        { "ingredients": category }, 
        { "directions": category }, 
        { "description": category }] }).collation({ locale: "en", strength: 2 }).skip((perPage * pageNumber) - perPage).limit(perPage).sort({ createdAt: -1 }).exec(function (err, foundRecipe) {
        Recipe.count({ $or: [{ "title": category }, { "allergens": category }, { "tags": category }, { "category": category }, { "ingredients": category }, { "directions": category }, { "description": category }] }).exec(function (err, count) {
            if (err) {
                req.flash("error", "An Error Occurred. The category you are looking for may not exist. Please try again.");
                res.redirect("back");
            }
            else {
                if(foundRecipe.length == 0){
                    req.flash("error", "There are no recipes in this category. Please try another category.");
                    res.redirect("back");  
                }
                else {
                    res.render("categories", { 
                        foundRecipe: foundRecipe, 
                        category: category,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: false,
                        perPage: perPage
                    });
                }
            }
        });
    });
});

module.exports = router;
