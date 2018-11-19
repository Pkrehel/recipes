var mongoose = require("mongoose");

var lovedBySchema = mongoose.Schema({
    createdAt: { type: Date, default: Date.now },
    person: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        screenName: String
    }
});

module.exports = mongoose.model("lovedBy", lovedBySchema);
