const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    rating: {
      type: Number,
      required: [true, "Please provide a rating (1-5 stars)."],
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: "{VALUE} is not a whole number." }
    },
    text: { type: String, trim: true, maxlength: 2000 },
    author: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      screenName: String
    },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe", required: true, index: true }
  },
  { timestamps: true }
);

// one review per user per recipe
reviewSchema.index({ recipe: 1, "author.id": 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
