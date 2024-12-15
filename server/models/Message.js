const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: { type: String }, // Remove required: true
  imageUrl: { type: String }, // Add field for image URL
  emoji: { type: String }, // Add field for emoji
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" }, // Add field for post
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
