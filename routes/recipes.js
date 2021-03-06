var express = require("express"),
  router = express.Router(),
  Recipe = require("../models/recipe"),
  User = require("../models/user"),
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

//CREATE ROUTE - Create a new recipe in the database
router.post("/", middleware.recipeRateLimits, middleware.isLoggedIn, upload.single('image'), function (req, res) {
  cloudinary.uploader.upload(req.file.path,
    function (result) {
      // add cloudinary url for the image to the recipe object under image property
      var image = result.secure_url;
      var imageId = result.public_id;
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
      var newRecipe = { chef: chef, image: image, imageId: imageId, title: title, description: description, ingredients: ingredients, prepTime: prepTime, cookTime: cookTime, totalTime: totalTime, directions: directions, category: category, tags: tags, allergens: allergens, difficulty: difficulty };
      Recipe.create(newRecipe, function (err, recipe) {
        if (err) {
          req.flash('error', err.message);
          return res.redirect('back');
        }
        User.findById(req.user._id, function(err, foundUser){
          if(err){
            req.flash('error', err.message);
            return res.redirect('back');
          }
          foundUser.recipes.push(recipe.id);
          foundUser.save();
        });
        res.redirect('/');
      });
    }, { categorization: "google_tagging", auto_tagging: 0.85, quality: "auto", width: 700, height: 525, gravity: "auto", crop: "fill" });
});

//NEW - create a new item on form
router.get("/new", middleware.isLoggedIn, function (req, res) {
  res.render("recipes/new");
});


//UNIQUE RECIPE SHOW ROUTE:
router.get("/:id", function (req, res) {
  Recipe.findByIdAndUpdate(req.params.id).populate('comments user reviews').exec(function (err, foundRecipe) {
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
router.get("/:id/edit", middleware.checkRecipeOwnership, function (req, res) {
  Recipe.findById(req.params.id, function (err, foundRecipe) {
    if (err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
    else {
      res.render("recipes/edit", { recipe: foundRecipe });
    }
  });
});

// recipe edit put route
router.put("/:id", middleware.recipeRateLimits, middleware.checkRecipeOwnership, upload.single('image'), function(req, res){
    Recipe.findById(req.params.id, async function(err, recipe){
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.file) {
              try {
                  await cloudinary.v2.uploader.destroy(recipe.imageId);
                  var result = await cloudinary.v2.uploader.upload(req.file.path);
                  recipe.imageId = result.public_id;
                  recipe.image = result.secure_url;
                  recipe.tags = result.tags;
              } catch(err) {
                  req.flash("error", err.message);
                  return res.redirect("back");
              }
            }
            recipe.title = req.body.title;
            recipe.description = req.body.description;
            recipe.ingredients = req.body.ingredients.filter(function (ingredient) {
              return ingredient.trim() != '';
      });

      recipe.prepTime = req.body.prepTime;
      recipe.cookTime = req.body.cookTime;
      recipe.totalTime = Number(req.body.prepTime) + Number(req.body.cookTime);
      recipe.allergens = req.body.allergens;
      recipe.directions = req.body.directions.filter(function (ingredient) { return ingredient.trim() != ''; });
      recipe.chef = req.body.chef = {
        id: req.user._id,
        screenName: req.user.screenName,
        avatar: req.user.avatar
      };
      recipe.category = req.body.category;
      recipe.difficulty = req.body.difficulty;
            recipe.save();
            req.flash("success","Successfully Updated!");
            res.redirect("/recipes/" + recipe._id);
        }
    });
});


module.exports = router;
