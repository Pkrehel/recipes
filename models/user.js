var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
    screenName: String,
    username: String,
    firstName: String,
    password: String,
    subtitle: String,
    bio: String,
    createdAt: { type: Date, default: Date.now },
    secretToken: String,
    verified: { Boolean, default: false },
    avatar: {
        type: String
    },
    lovedRecipes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Recipe"
    }],
    recipes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Recipe"
    }],
    searches: Array,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    favoriteCategories: Array
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
