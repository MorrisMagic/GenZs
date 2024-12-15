const mongoose = require("mongoose");
const postSchema = new mongoose.Schema({
  content: { type: String },
  imageUrl: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
  reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  repostsCount: { type: Number, default: 0 },
  isRepost: { type: Boolean, default: false },
  originalPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  mentions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: String,
      startIndex: Number,
      endIndex: Number,
    },
  ],
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
});

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
