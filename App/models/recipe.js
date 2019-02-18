var mongoose = require("mongoose");

var recipeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    description: { type: String, required: true },
    image: { type: String, required: true },
    chef: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        screenName: String,
        avatar: String
    },
    prepTime: Number,
    cookTime: Number,
    totalTime: {
        type: Number,
        required: true
    },
    directions: {
        type: Array,
        required: true
    },
    tags: Array,
    allergens: Array,
    ingredients: {
        type: Array,
        required: true
    },
    category: {
        type: String,
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Beverage', 'Other'],
        required: true
    },
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
    }],
    lovedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    difficulty: { type: Number, enum: [0, 1, 2] },
    views: {
        type: Number,
        default: 0
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review"
    }],
    rating: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("Recipe", recipeSchema);
