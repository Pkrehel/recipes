const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    author: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      screenName: String
    },
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe", required: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
