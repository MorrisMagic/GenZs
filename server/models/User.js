const mongoose = require("mongoose");
// User Schema
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  bio: { type: String },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  postsCount: { type: Number, default: 0 },
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  hoverCardData: {
    bio: String,
    profilePicture: String,
    followersCount: Number,
    followingCount: Number,
    postsCount: Number,
    recentPosts: [
      {
        content: String,
        createdAt: Date,
      },
    ],
  },
  notifications: [
    {
      type: {
        type: String,
        enum: ["like", "comment", "follow", "message", "call"],
      },
      from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
      callType: { type: String, enum: ["video", "voice"] },
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

const User = mongoose.model("User", userSchema);

module.exports = User;
