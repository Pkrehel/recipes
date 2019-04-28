var express = require("express"),
    router = express.Router(),
    Recipe = require("../models/recipe");

//Show the home page
router.get("/:category", function (req, res) {
    var category = req.params.category;
    console.log(category);
    Recipe.find({ $or: [{ "title": category }, { "allergens": category }, { "tags": category }, { "category": category }, { "ingredients": category }, { "directions": category }, { "description": category }] }).collation({ locale: "en", strength: 2 }).limit(12).exec(function (err, foundRecipe) {
        if (err) {
            req.flash("error", "An Error Occurred. The category you are looking for may not exist. Please try again.");
            res.redirect("back");
        }
        else {
            if (foundRecipe.length < 1) {
                req.flash("error", "No recipes can be found! Please try another search, or adjust your filters.");
                res.redirect("back");
            }
            res.render("categories", { foundRecipe: foundRecipe, category: category });
        }
    });
});

module.exports = router;
