var express = require("express"),
  router = express.Router(),
  Recipe = require("../models/recipe"),
  middleware = require("../middleware"),
  multer = require('multer');

var storage = multer.diskStorage({
  filename: function (req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});

var imageFilter = function (req, file, cb) {
  // accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error('Only JPG, JPEG, PNG & GIF image files are allowed!'), false);
  }
  cb(null, true);
};

var upload = multer({ storage: storage, fileFilter: imageFilter });

var cloudinary = require('cloudinary');
cloudinary.config({
  cloud_name: 'palmer',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

//INDEX ROUTE - Shows all items
router.get("/", function (req, res) {
  Recipe.find({}, function (err, allRecipes) {
    if (err) {
      console.log(err);
    }
    else {
      res.render("recipes/index", { recipes: allRecipes, currentUser: req.user });
    }
  });
});

//CREATE ROUTE - Create a new item in the database
router.post("/", middleware.isLoggedIn, upload.single('image'), function (req, res) {
  cloudinary.uploader.upload(req.file.path,
    function (result) {
      // add cloudinary url for the image to the campground object under image property
      var image = result.secure_url;
      var tags = result.tags;
      var title = req.body.title;
      var description = req.body.description;
      var ingredients = req.body.ingredients.filter(function (ingredient) {
        return ingredient.trim() != '';
      });

      var prepTime = req.body.prepTime;
      var cookTime = req.body.cookTime;
      var totalTime = Number(req.body.prepTime) + Number(req.body.cookTime);
      var allergens = req.body.allergens;
      var directions = req.body.directions.filter(function (ingredient) { return ingredient.trim() != ''; });
      var chef = req.body.chef = {
        id: req.user._id,
        screenName: req.user.screenName,
        avatar: req.user.avatar
      };
      var category = req.body.category;
      var difficulty = req.body.difficulty;
      var newRecipe = { chef: chef, image: image, title: title, description: description, ingredients: ingredients, prepTime: prepTime, cookTime: cookTime, totalTime: totalTime, directions: directions, category: category, tags: tags, allergens: allergens, difficulty: difficulty };
      Recipe.create(newRecipe, function (err, recipe) {
        if (err) {
          req.flash('error', err.message);
          return res.redirect('back');
        }
        res.redirect('/');
      });
    }, { categorization: "google_tagging", auto_tagging: 0.70, quality: "auto", width: 700, height: 525, gravity: "auto", crop: "fill" });
});

//NEW - create a new item on form
router.get("/new", middleware.isLoggedIn, function (req, res) {
  res.render("recipes/new");
});


//UNIQUE RECIPE SHOW ROUTE:
router.get("/:id", function (req, res) {
  Recipe.findByIdAndUpdate(req.params.id).populate('comments lovedBy user avatar toMake reviews').exec(function (err, foundRecipe) {
    if (err) {
      req.flash("error", "Whoops, we cannot find that recipe. It may have been removed.");
      res.redirect("back");
    }
    else {
      if ((req.user && (req.user.id != foundRecipe.chef.id)) || !req.user) {
        foundRecipe.views = foundRecipe.views + 1;
        foundRecipe.save();
        res.render("recipes/show", { recipe: foundRecipe });
      }
      else {
        res.render("recipes/show", { recipe: foundRecipe });
      }
    }
  });
});

//RECIPE EDIT SHOW ROUTE:
router.get("/edit/:id", function (req, res) {
  Recipe.findById(req.params.id, function (err, foundRecipe) {
    if (err) {
      res.redirect("back");
    }
    else {
      res.render("recipes/edit", { recipe: foundRecipe });
    }
  });
});


//RECIPE UPDATE ROUTE:
router.put("/edit/:id", function (req, res) {
  Recipe.findByIdAndUpdate(req.params.id, req.body.recipe, function (err, updatedRecipe) {
    if (err) {
      console.log(err);
    }
    else {
      res.render("home");
    }
  });
});

module.exports = router;
