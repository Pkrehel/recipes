var express = require("express");
var router = express.Router({ mergeParams: true });
var Recipe = require("../models/recipe");
var Comment = require("../models/comment");

//Comments Create
router.post("/", function(req, res) {
    //lookup recipe using ID
    Recipe.findById(req.params.id, function(err, recipe) {
        if (err) {
            console.log(err);
            res.redirect("/recipes");
        }
        else {
            Comment.create(req.body.comment, function(err, comment) {
                if (err) {
                    console.log(err);
                }
                else {
                    //add username and id to comment
                    comment.author.id = req.user._id;
                    comment.author.screenName = req.user.screenName;
                    //save comment
                    comment.save();
                    recipe.comments.unshift(comment._id);
                    recipe.save();
                    req.flash('success', 'Created a comment!');
                    res.redirect('/recipes/' + recipe._id);
                }
            });
        }
    });
});

module.exports = router;
