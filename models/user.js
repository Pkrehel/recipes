const mongoose = require("mongoose");
const plm = require("passport-local-mongoose");
const passportLocalMongoose = plm.default || plm;

const UserSchema = new mongoose.Schema(
  {
    // `username` is the login identifier (an email address) used by passport-local-mongoose
    username: { type: String, required: true, lowercase: true, trim: true },
    screenName: { type: String, required: true, trim: true, minlength: 3, maxlength: 30 },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    avatar: { type: String, default: "🍳" },
    bio: { type: String, maxlength: 500 },
    verified: { type: Boolean, default: false },
    verificationToken: String,
    verificationExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    lovedRecipes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Recipe" }],
    recipes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Recipe" }],
    favoriteCategories: [String]
  },
  { timestamps: true }
);

UserSchema.index({ screenName: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

UserSchema.plugin(passportLocalMongoose, {
  usernameField: "username",
  usernameLowerCase: true,
  usernameQueryFields: ["username"],
  errorMessages: {
    UserExistsError: "An account with that email address already exists.",
    IncorrectPasswordError: "Incorrect email or password.",
    IncorrectUsernameError: "Incorrect email or password.",
    MissingPasswordError: "Please enter a password.",
    AttemptTooSoonError: "Account is temporarily locked. Try again shortly.",
    TooManyAttemptsError: "Account locked due to too many failed login attempts."
  },
  limitAttempts: true,
  maxAttempts: 10
});

module.exports = mongoose.model("User", UserSchema);
