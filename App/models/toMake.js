var mongoose = require("mongoose");

var toMakeSchema = mongoose.Schema({
    createdAt: { type: Date, default: Date.now },
    userId: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    recipe: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Recipe"
        },
        title: String
    }
});


module.exports = mongoose.model("toMake", toMakeSchema);
