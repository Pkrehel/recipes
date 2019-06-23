var express = require("express"),
    router = express.Router(),
    Recipe = require("../models/recipe");

router.get("/v1/recipes", function (req, res) {
    var sortBy = req.query.sortBy
    var orderBy = req.query.orderBy
    var offset = req.query.offset
    var sort
    var limit = 6;
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
    Recipe.find()
    .sort(sort.toString()).skip(offset).limit(limit).exec(function (err, recipes) {
        if (err) {
            res.send(err);
        }
        else {
            res.send(recipes)
        }
    });
});

module.exports = router;