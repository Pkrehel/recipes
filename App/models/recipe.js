var mongoose = require("mongoose");

var recipeSchema = new mongoose.Schema({
    title: String,
    createdAt: { type: Date, default: Date.now },
    description: String,
    image: String,
    chef: {
        id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            screenName: String,
            avatar: String
    },
    avatar: String,
    prepTime: String,
    cookTime: String,
    directions: Array,
    tags: Array,
    allergens: Array,
    ingredients: Array,
    category: {
        type: String,
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Beverage', 'Other']
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    }],
    lovedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }]
});

module.exports = mongoose.model("Recipe", recipeSchema);
