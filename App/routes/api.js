// var express = require("express"),
//     router = express.Router(),
//     Recipe = require("../models/recipe");

// router.get("/v1/Recipes", function (req, res) {
//     var sort = req.query.sort,
//         order_by = req.query.order,
//         limit = req.query.limit
//     Recipe.find({}).limit(500).exec(function (err, allRecipes) {
//         if (err) {
//             res.send(err);
//         }
//         else {
//             res.send(allRecipes)
//         }
//     });
// });

// module.exports = router;


var express = require("express"),
    router = express.Router(),
    Recipe = require("../models/recipe");

router.get("/v1/Recipes", function (req, res) {
    var sort = req.query.sort,
        order_by = req.query.order,
        limit = req.query.limit
    Recipe.find({}).limit(500).exec(function (err, allRecipes) {
        if (err) {
            res.send(err);
        }
        else {
            res.send(allRecipes)
        }
    });
});

module.exports = router;