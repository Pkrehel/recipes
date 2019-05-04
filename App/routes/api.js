var express = require("express"),
    router = express.Router(),
    Recipe = require("../models/recipe");



router.get("/v1/Recipes", function (req, res) {
    var sortBy = req.query.sortBy
    var orderBy = req.query.orderBy
    var sort
    var limit = req.query.limit
    if(sortBy === '1'){
        sort = "" + orderBy
    } else {
        sort = '-' + orderBy
    }
    if(parseInt(limit) <= 500){
        limit = parseInt(limit)
    } else{
        limit = 500
    }
    console.log(limit)
    console.log(sort)
    Recipe.find()
    .sort(sort.toString()).limit(limit).exec(function (err, recipes) {
        if (err) {
            res.send(err);
        }
        else {
            res.send(recipes)
        }
    });
});

module.exports = router;