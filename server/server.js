const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const port = process.env.PORT || 5000;
const cors = require("cors");
const cookieParser = require("cookie-parser");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const User = require("./models/User");
const Message = require("./models/Message");
const Comment = require("./models/Comment");
const Post = require("./models/Post");
const authenticateToken = require("./middlewares/authenticateToken");
const connectDB = require("./connectdb");
const authRoutes = require("./routes/AuthRoute");
const path = require("path");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for temporary storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "tmp"));
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Connect to MongoDB
connectDB();

// Message Schema

// Comment Schema

// Post Schema

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Initialize Socket.IO with session handling
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Authentication middleware
app.use("/api/auth", authRoutes);

// Helper function to create notification
const createNotification = async (
  type,
  fromUserId,
  toUserId,
  postId = null
) => {
  try {
    // Don't create notification if user is notifying themselves
    if (fromUserId.toString() === toUserId.toString()) {
      return;
    }

    const user = await User.findById(toUserId);
    if (!user) return;

    // Check for duplicate notifications
    const duplicateNotification = user.notifications.find(
      (notification) =>
        notification.type === type &&
        notification.from.toString() === fromUserId.toString() &&
        (!postId || notification.post?.toString() === postId.toString()) &&
        !notification.read &&
        // Check if notification is less than 1 hour old
        new Date() - notification.createdAt < 3600000
    );

    if (duplicateNotification) {
      return;
    }

    const notification = {
      type,
      from: fromUserId,
      post: postId,
      read: false,
      createdAt: new Date(),
    };

    // Add notification to user's notifications array
    user.notifications.unshift(notification);
    
    // Save user document and populate notification in parallel
    const [savedUser, populatedUser] = await Promise.all([
      user.save(),
      User.findById(toUserId)
        .populate({
          path: "notifications.from",
          select: "username profilePicture", 
        })
        .populate("notifications.post")
    ]);

    const newNotification = populatedUser.notifications[0];

    // Emit notification to all connected sockets
    io.emit('notification', {
      notification: newNotification,
      userId: toUserId
    });

    // Also emit to specific user's room
    io.to(`user_${toUserId}`).emit('newNotification', {
      notification: newNotification,
      userId: toUserId
    });

  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

// Helper function to check if users can chat
const canUsersChat = async (userId1, userId2) => {
  const user1 = await User.findById(userId1);
  const user2 = await User.findById(userId2);

  return user1.following.includes(userId2) && user2.following.includes(userId1);
};

// Send message with image and emoji support
app.post(
  "/messages/:recipientId",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { content, emoji } = req.body;
      const senderId = req.userId;
      const recipientId = req.params.recipientId;

      // Check if users can chat (follow each other)
      const canChat = await canUsersChat(senderId, recipientId);
      if (!canChat) {
        return res.status(403).json({
          error: "You can only chat with users who follow each other",
        });
      }

      // Require either content or image
      if (!content && !req.file) {
        return res
          .status(400)
          .json({ error: "Message must contain either text or an image" });
      }

      let imageUrl;
      if (req.file) {
        // Upload image to Cloudinary if present
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.secure_url;
      }

      const message = new Message({
        sender: senderId,
        recipient: recipientId,
        content: content || "", // Allow empty content if there's an image
        imageUrl,
        emoji,
      });

      await message.save();

      // Populate sender details
      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "username profilePicture")
        .populate("recipient", "username profilePicture");

      // Create notification for new message
      await createNotification("message", senderId, recipientId);

      // Emit message to recipient
      io.emit(`chat-${recipientId}`, populatedMessage);

      res.status(201).json(populatedMessage);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

// Get chat history
app.get("/messages/:userId", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    // Check if users can chat
    const canChat = await canUsersChat(currentUserId, otherUserId);
    if (!canChat) {
      return res.status(403).json({
        error: "You can only view chats with users who follow each other",
      });
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: otherUserId },
        { sender: otherUserId, recipient: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username profilePicture")
      .populate("recipient", "username profilePicture")
      .populate({
        path: "post",
        select: "content imageUrl",
        populate: {
          path: "author",
          select: "username profilePicture",
        },
      }); // Populate post content and author details

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Mark messages as read
app.put("/messages/:senderId/read", authenticateToken, async (req, res) => {
  try {
    const recipientId = req.userId;
    const senderId = req.params.senderId;

    await Message.updateMany(
      { sender: senderId, recipient: recipientId, read: false },
      { read: true }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

// Get chat list
app.get("/chats", authenticateToken, async (req, res) => {
  try {
    // Get all messages where user is either sender or recipient
    const messages = await Message.find({
      $or: [{ sender: req.userId }, { recipient: req.userId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username profilePicture")
      .populate("recipient", "username profilePicture");

    // Get unique chat partners
    const chatPartners = new Map();

    messages.forEach((message) => {
      const partnerId =
        message.sender._id.toString() === req.userId
          ? message.recipient._id.toString()
          : message.sender._id.toString();

      if (!chatPartners.has(partnerId)) {
        chatPartners.set(partnerId, {
          user:
            message.sender._id.toString() === req.userId
              ? message.recipient
              : message.sender,
          lastMessage: message,
          unreadCount:
            message.recipient._id.toString() === req.userId && !message.read
              ? 1
              : 0,
        });
      } else if (
        message.recipient._id.toString() === req.userId &&
        !message.read
      ) {
        chatPartners.get(partnerId).unreadCount++;
      }
    });

    const chatList = Array.from(chatPartners.values());

    res.json(chatList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat list" });
  }
});
// Get notifications
app.get("/notifications", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: "notifications.from",
        select: "username profilePicture",
      })
      .populate("notifications.post");

    res.json(user.notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
app.put(
  "/notifications/:notificationId/read",
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      const notification = user.notifications.id(req.params.notificationId);

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      notification.read = true;
      await user.save();

      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification" });
    }
  }
);

// Mark all notifications as read
app.put("/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.notifications.forEach((notification) => {
      notification.read = true;
    });
    await user.save();

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// Update profile picture
app.post(
  "/user/profile-picture",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If user already has a profile picture, delete it from Cloudinary
      if (user.profilePicture) {
        const publicId = user.profilePicture.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }

      // Upload new image to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path);

      // Update user's profile picture URL
      user.profilePicture = result.secure_url;
      await user.save();

      res.json({
        message: "Profile picture updated successfully",
        profilePicture: result.secure_url,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update profile picture" });
    }
  }
);

// Follow/Unfollow user
app.post("/user/:userId/follow", authenticateToken, async (req, res) => {
  try {
    if (req.userId === req.params.userId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const userToFollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.userId);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isFollowing = currentUser.following.includes(req.params.userId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== req.params.userId
      );
      userToFollow.followers = userToFollow.followers.filter(
        (id) => id.toString() !== req.userId
      );
    } else {
      // Follow
      currentUser.following.push(req.params.userId);
      userToFollow.followers.push(req.userId);
      // Create notification for follow
      await createNotification("follow", req.userId, req.params.userId);
    }

    await currentUser.save();
    await userToFollow.save();

    // Emit follow/unfollow event
    io.emit("followUpdate", {
      followerId: req.userId,
      followedId: req.params.userId,
      action: isFollowing ? "unfollow" : "follow",
    });

    res.json({
      message: isFollowing
        ? "Unfollowed successfully"
        : "Followed successfully",
      followers: userToFollow.followers.length,
      following: currentUser.following.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update follow status" });
  }
});

// Get current user

// Get specific user by ID
app.get("/user/:userId", async (req, res) => {
  try {
    if (!req.params.userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Get user profile and their posts
app.get("/profile/:userId", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    res.json({
      user,
      posts,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Create a new post
app.post(
  "/posts",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { content } = req.body;
      let imageUrl;

      if (req.file) {
        // Upload image to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.secure_url;
      }

      const post = new Post({
        content,
        author: req.userId,
        likes: [],
        comments: [],
        imageUrl,
      });
      await post.save();

      // Update user's post count
      await User.findByIdAndUpdate(req.userId, { $inc: { postsCount: 1 } });

      // Fetch the populated post to include author details
      const populatedPost = await Post.findById(post._id)
        .populate("author", "username profilePicture")
        .populate({
          path: "comments",
          populate: { path: "author", select: "username profilePicture" },
        });

      // Emit the new post to all connected clients
      io.emit("newPost", populatedPost);

      res.status(201).json(populatedPost);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  }
);

// Get single post
app.get("/posts/:postId", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Like/Unlike a post
app.post("/posts/:postId/like", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const likeIndex = post.likes.indexOf(req.userId);
    if (likeIndex === -1) {
      post.likes.push(req.userId);
      // Create notification for like if the post author is not the same as the liker
      if (post.author.toString() !== req.userId) {
        await createNotification("like", req.userId, post.author, post._id);
      }
    } else {
      post.likes.splice(likeIndex, 1);
    }
    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    io.emit("postUpdated", updatedPost);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Failed to update like" });
  }
});

// Add comment to post
app.post("/posts/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = new Comment({
      content,
      author: req.userId,
      post: post._id,
    });
    await comment.save();

    post.comments.push(comment._id);
    await post.save();

    // Create notification for comment if the post author is not the same as the commenter
    if (post.author.toString() !== req.userId) {
      await createNotification("comment", req.userId, post.author, post._id);
    }

    const updatedPost = await Post.findById(post._id)
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    io.emit("postUpdated", updatedPost);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Delete a comment
app.delete(
  "/posts/:postId/comments/:commentId",
  authenticateToken,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      // Find the comment and check if user is the author
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (comment.author.toString() !== req.userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this comment" });
      }

      // Remove comment from post and delete the comment
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      post.comments = post.comments.filter((c) => c.toString() !== commentId);
      await post.save();
      await Comment.findByIdAndDelete(commentId);

      const updatedPost = await Post.findById(postId)
        .populate("author", "username profilePicture")
        .populate({
          path: "comments",
          populate: { path: "author", select: "username profilePicture" },
        });

      io.emit("postUpdated", updatedPost);
      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  }
);

// Delete a post
app.delete("/posts/:postId", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if user is the author of the post
    if (post.author.toString() !== req.userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this post" });
    }

    // Delete image from Cloudinary if exists
    if (post.imageUrl) {
      const publicId = post.imageUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }

    // Delete all comments associated with the post
    await Comment.deleteMany({ post: post._id });

    // Delete the post and decrement user's post count
    await Post.findByIdAndDelete(req.params.postId);
    await User.findByIdAndUpdate(req.userId, { $inc: { postsCount: -1 } });

    // Emit post deletion event to all connected clients
    io.emit("postDeleted", req.params.postId);

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// Get user's posts
app.get("/user/:userId/posts", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user posts" });
  }
});

// Get all posts
app.get("/posts", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      })
      .populate({
        path: "originalPost",
        populate: { path: "author", select: "username profilePicture" },
      });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});
// Save/unsave post
app.post("/posts/:postId/save", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Update post's savedBy array
    const isSaved = post.savedBy && post.savedBy.includes(req.userId);

    if (isSaved) {
      // Remove user from savedBy array
      post.savedBy = post.savedBy.filter((id) => id.toString() !== req.userId);
    } else {
      // Add user to savedBy array
      if (!post.savedBy) {
        post.savedBy = [];
      }
      post.savedBy.push(req.userId);
    }

    await post.save();

    // Update user's savedPosts array
    const user = await User.findById(req.userId);
    if (isSaved) {
      user.savedPosts = user.savedPosts.filter(
        (id) => id.toString() !== req.params.postId
      );
    } else {
      user.savedPosts.push(req.params.postId);
    }
    await user.save();

    res.json({
      message: isSaved
        ? "Post unsaved successfully"
        : "Post saved successfully",
      saved: !isSaved,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update saved status" });
  }
});

// Get saved posts
app.get("/saved", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const savedPosts = await Post.find({
      _id: { $in: user.savedPosts },
    })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      })
      .populate("savedBy");

    res.json(savedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch saved posts" });
  }
});
// Search for users
// Search users
app.get("/search/users", authenticateToken, async (req, res) => {
  try {
    const searchQuery = req.query.q;
    if (!searchQuery) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Search users by username, name, or bio with case insensitive matching
    const users = await User.find({
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { name: { $regex: searchQuery, $options: "i" } },
        { bio: { $regex: searchQuery, $options: "i" } },
      ],
    })
      .select("username name profilePicture bio followers following")
      .sort({ followers: -1 }) // Sort by follower count
      .limit(20);

    // Don't send back sensitive information
    const sanitizedUsers = await Promise.all(
      users.map(async (user) => {
        // Get follower and following counts
        const followersCount = user.followers?.length || 0;
        const followingCount = user.following?.length || 0;

        // Check if current user is following this user
        const isFollowing = user.followers?.includes(req.userId);

        return {
          _id: user._id,
          username: user.username,
          name: user.name,
          profilePicture: user.profilePicture,
          bio: user.bio,
          followersCount,
          followingCount,
          isFollowing,
        };
      })
    );

    res.json(sanitizedUsers);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

// Get personalized user suggestions
app.get("/users/suggestions", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get users followed by people the current user follows
    const followedUsers = currentUser.following || [];
    const suggestedUsers = await User.find({
      $and: [
        // Not already followed
        { _id: { $nin: [...followedUsers, req.userId] } },
        // Followed by users that current user follows
        { followers: { $in: followedUsers } },
      ],
    })
      .select("username name profilePicture bio followers")
      .sort({ followers: -1 }) // Prioritize users with more followers
      .limit(10);

    // If not enough suggestions, add some random users
    if (suggestedUsers.length < 10) {
      const remainingCount = 10 - suggestedUsers.length;
      const randomUsers = await User.find({
        _id: {
          $nin: [
            ...followedUsers,
            req.userId,
            ...suggestedUsers.map((u) => u._id),
          ],
        },
      })
        .select("username name profilePicture bio followers")
        .sort({ followers: -1 })
        .limit(remainingCount);

      suggestedUsers.push(...randomUsers);
    }

    res.json(suggestedUsers);
  } catch (error) {
    console.error("User suggestions error:", error);
    res.status(500).json({ error: "Failed to get user suggestions" });
  }
});

// Create a repost
app.post("/posts/:postId/repost", authenticateToken, async (req, res) => {
  const { postId } = req.params;
  console.log("postId", postId);
  try {
    const originalPost = await Post.findById(req.params.postId)
      .populate("author", "username profilePicture")
      .populate("originalPost", "author username profilePicture");

    if (!originalPost) {
      return res.status(404).json({ error: "Original post not found" });
    }

    // Check if user already reposted
    const existingRepost = await Post.findOne({
      originalPost: req.params.postId,
      author: req.userId,
      isRepost: true,
    });

    if (existingRepost) {
      return res
        .status(400)
        .json({ error: "You have already reposted this post" });
    }

    // Create repost
    const repost = new Post({
      content: originalPost.content,
      imageUrl: originalPost.imageUrl,
      author: req.userId,
      originalPost: req.params.postId, // Just store the ID reference
      isRepost: true,
      createdAt: new Date(),
    });

    await repost.save();

    // Populate the repost with author and original post details
    await repost.populate([
      {
        path: "author",
        select: "username profilePicture",
      },
      {
        path: "originalPost",
        populate: {
          path: "author",
          select: "username profilePicture",
        },
      },
    ]);

    // Update original post's repost count and reposts array
    if (!originalPost.reposts) {
      originalPost.reposts = [];
    }
    originalPost.reposts.push(req.userId);
    originalPost.repostsCount = originalPost.reposts.length;
    await originalPost.save();

    // Create notification for the original post author
    const newNotification = new Notification({
      type: "repost",
      from: req.userId,
      to: originalPost.author._id,
      post: originalPost._id,
      createdAt: new Date(),
    });
    await newNotification.save();
    await newNotification.populate("from", "username profilePicture");

    // Emit socket events
    io.emit("postUpdated", originalPost);
    io.emit("newRepost", repost._id); // Emit event for new repost
    io.to(`user-${originalPost.author._id}`).emit(
      "notification",
      newNotification
    );

    res.status(201).json({
      success: true,
      repost,
    });
  } catch (error) {
    console.error("Create repost error:", error);
    res.status(500).json({ error: "Failed to create repost" });
  }
});

// Delete a repost
app.delete("/posts/:postId/repost", authenticateToken, async (req, res) => {
  try {
    // Find original post first to ensure it exists
    const originalPost = await Post.findById(req.params.postId).populate(
      "author",
      "username profilePicture"
    );

    if (!originalPost) {
      return res.status(404).json({ error: "Original post not found" });
    }

    // Find and delete repost
    const repost = await Post.findOneAndDelete({
      originalPost: req.params.postId,
      author: req.userId,
      isRepost: true,
    });

    if (!repost) {
      return res.status(404).json({ error: "Repost not found" });
    }

    // Correctly decrement the repostsCount
    originalPost.repostsCount = Math.max(0, originalPost.repostsCount - 1);

    await originalPost.updateOne({
      $pull: { reposts: req.userId },
      $inc: { repostsCount: -1 },
    });

    // If the reposted post is deleted, update the original post's isRepost field
    if (originalPost.repostsCount === 0) {
      originalPost.isRepost = false;
    }

    await originalPost.save();

    // Delete associated notification
    await Notification.deleteOne({
      type: "repost",
      from: req.userId,
      post: originalPost._id,
    });

    // Emit socket events
    io.emit("postUpdated", originalPost);
    io.emit("postDeleted", repost._id);

    res.json({ message: "Repost deleted successfully" });
  } catch (error) {
    console.error("Delete repost error:", error);
    res.status(500).json({ error: "Failed to delete repost" });
  }
});
// Get user ID by username
app.get(
  "/api/users/username/:username",
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findOne({ username: req.params.username });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ _id: user._id });
    } catch (error) {
      console.error("Error fetching user by username:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  }
);
// Get user profile data for hover card
app.get("/api/users/:username", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select("username bio profilePicture followers following posts")
      .populate("followers", "username")
      .populate("following", "username")
      .populate("posts", "content createdAt");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Format the response data
    const profileData = {
      username: user.username,
      bio: user.bio || "",
      profilePicture:
        user.profilePicture ||
        `https://ui-avatars.com/api/?name=${user.username}`,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      postsCount: user.posts.length,
      recentPosts: user.posts.slice(0, 3).map((post) => ({
        content: post.content,
        createdAt: post.createdAt,
      })),
    };

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching user hover data:", error);
    res.status(500).json({ error: "Failed to fetch user hover data" });
  }
});
// Endpoint to get online users
app.get("/api/users/online", authenticateToken, async (req, res) => {
  try {
    const onlineUsers = Array.from(io.sockets.sockets.keys());
    res.json({ onlineUsers });
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({ error: "Failed to fetch online users" });
  }
});

// Endpoint to get offline users
app.get("/api/users/offline", authenticateToken, async (req, res) => {
  try {
    const allUsers = await User.find().select("_id");
    const onlineUsers = new Set(io.sockets.sockets.keys());
    const offlineUsers = allUsers.filter(
      (user) => !onlineUsers.has(user._id.toString())
    );
    res.json({ offlineUsers });
  } catch (error) {
    console.error("Error fetching offline users:", error);
    res.status(500).json({ error: "Failed to fetch offline users" });
  }
});

app.get("/api/user/mentions/:username", authenticateToken, async (req, res) => {
  const username = req.params.username;
  const user = await User.findOne({ username: username });
  const mentions = user.mentions;
  res.json(mentions);
});

// Endpoint to get posts by hashtag
app.get("/api/hashtags/:hashtag", authenticateToken, async (req, res) => {
  try {
    const hashtag = req.params.hashtag;
    const posts = await Post.find({ content: new RegExp(`#${hashtag}`, "i") })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts by hashtag:", error);
    res.status(500).json({ error: "Failed to fetch posts by hashtag" });
  }
});

// Endpoint to get all hashtags
app.get("/api/hashtags", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({
      content: { $regex: "(^|\\s)#\\w+", $options: "i" },
    });
    const hashtags = posts.reduce((acc, post) => {
      const matches = post.content.match(/(^|\s)#\w+/g);
      if (matches) {
        matches.forEach((hashtag) => {
          const trimmedHashtag = hashtag.trim();
          if (!acc.includes(trimmedHashtag)) {
            acc.push(trimmedHashtag);
          }
        });
      }
      return acc;
    }, []);
    res.json(hashtags);
  } catch (error) {
    console.error("Error fetching hashtags:", error);
    res.status(500).json({ error: "Failed to fetch hashtags" });
  }
});

// Endpoint to get the people the user follows
app.get("/api/users/:userId/following", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).populate(
      "following",
      "username profilePicture"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user.following);
  } catch (error) {
    console.error("Error fetching following users:", error);
    res.status(500).json({ error: "Failed to fetch following users" });
  }
});

// Endpoint to send a post in a message
app.post("/api/messages/sendPost", authenticateToken, async (req, res) => {
  try {
    const { senderId, recipientId, postId, content } = req.body;

    // Validate sender and recipient
    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);
    if (!sender || !recipient) {
      return res.status(404).json({ error: "Sender or recipient not found" });
    }

    // Validate and get post data
    const post = await Post.findById(postId).populate(
      "author",
      "username profilePicture"
    );

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Create a new message with post data
    const newMessage = new Message({
      sender: senderId,
      recipient: recipientId,
      content: content || "",
      post: post,
    });

    // Save the message
    await newMessage.save();

    // Emit the new message to the recipient in real-time
    io.emit(`chat-${recipientId}`, newMessage);

    // Respond with the new message and post data
    res.status(201).json({ message: newMessage, post });
  } catch (error) {
    console.error("Error sending post in message:", error);
    res.status(500).json({ error: "Failed to send post in message" });
  }
});

// Endpoint to get suggested users
app.get("/api/suggested", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Get current user's following list
    const currentUser = await User.findById(userId).populate('following');
    const followingIds = currentUser.following.map(user => user._id);
    
    // Add current user's ID to exclude from suggestions
    followingIds.push(userId);

    // Find users that the current user is not following
    // Limit to 5 suggestions and sort randomly
    const suggestedUsers = await User.aggregate([
      { 
        $match: {
          _id: { $nin: followingIds }
        }
      },
      { 
        $project: {
          username: 1,
          name: 1,
          profilePicture: 1,
          followers: 1,
          following: 1
        }
      },
      { $sample: { size: 5 } }
    ]);

    res.status(200).json(suggestedUsers);
  } catch (error) {
    console.error("Error fetching suggested users:", error);
    res.status(500).json({ error: "Failed to fetch suggested users" });
  }
});

// Get notifications for current user
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: "notifications.from",
        select: "username profilePicture"
      })
      .populate({
        path: "notifications.post",
        select: "content image"
      });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Sort notifications by date descending
    const notifications = user.notifications.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(notifications);

  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
app.put("/api/notifications/:notificationId", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const notification = user.notifications.id(req.params.notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.read = true;
    await user.save();

    res.json({ message: "Notification marked as read" });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// Mark chat messages as seen
app.put("/api/messages/:messageId/seen", authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only recipient can mark message as seen
    if (message.recipient.toString() !== req.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!message.seen) {
      message.seen = true;
      await message.save();

      // Create notification for unseen message
      await createNotification(
        "unread_message", 
        message.sender,
        message.recipient
      );

      // Emit message seen status
      io.to(`chat_${message.sender}_${message.recipient}`).emit("messageSeen", {
        messageId: message._id,
        seen: true
      });
    }

    res.json({ message: "Message marked as seen" });

  } catch (error) {
    console.error("Error marking message as seen:", error);
    res.status(500).json({ error: "Failed to mark message as seen" });
  }
});
// Get online users
app.get("/api/users/online", authenticateToken, async (req, res) => {
  try {
    // Get array of connected socket IDs
    const connectedSockets = Array.from(io.sockets.sockets.keys());

    // Return list of online socket IDs
    res.json({
      onlineUsers: connectedSockets
    });

  } catch (error) {
    console.error("Error getting online users:", error);
    res.status(500).json({ error: "Failed to get online users" });
  }
});
// Get followers and following
app.get("/api/users/:userId/connections", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      followers: user.followers,
      following: user.following
    });

  } catch (error) {
    console.error("Error getting user connections:", error);
    res.status(500).json({ error: "Failed to get user connections" });
  }
});

// Follow a user
app.post("/api/users/:userId/follow", authenticateToken, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.userId);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userToFollow._id.toString() === currentUser._id.toString()) {
      return res.status(400).json({ error: "Users cannot follow themselves" });
    }

    // Check if already following
    if (currentUser.following.includes(userToFollow._id)) {
      return res.status(400).json({ error: "Already following this user" });
    }

    // Add to following/followers
    currentUser.following.push(userToFollow._id);
    userToFollow.followers.push(currentUser._id);

    await currentUser.save();
    await userToFollow.save();

    // Create notification for new follower
    await createNotification(
      "new_follower",
      currentUser._id,
      userToFollow._id
    );

    // Emit socket event for real-time updates
    io.to(`user_${userToFollow._id}`).emit("newFollower", {
      follower: {
        _id: currentUser._id,
        username: currentUser.username,
        profilePicture: currentUser.profilePicture
      }
    });

    res.json({ message: "Successfully followed user" });

  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

// Unfollow a user
app.post("/api/users/:userId/unfollow", authenticateToken, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.userId);

    if (!userToUnfollow || !currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove from following/followers
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== userToUnfollow._id.toString()
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== currentUser._id.toString()
    );

    await currentUser.save();
    await userToUnfollow.save();

    // Emit socket event for real-time updates
    io.to(`user_${userToUnfollow._id}`).emit("unfollowed", {
      unfollower: currentUser._id
    });

    res.json({ message: "Successfully unfollowed user" });

  } catch (error) {
    console.error("Error unfollowing user:", error);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

// Get user followers
app.get("/user/:userId/followers", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', '_id username profilePicture')
      .select('followers');

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user.followers);

  } catch (error) {
    console.error("Error getting followers:", error);
    res.status(500).json({ error: "Failed to get followers" });
  }
});

// Get user following
app.get("/user/:userId/following", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', '_id username profilePicture')
      .select('following');

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user.following);

  } catch (error) {
    console.error("Error getting following:", error);
    res.status(500).json({ error: "Failed to get following" });
  }
});
// Update user bio
app.put("/user/bio", async (req, res) => {
  try {
    const { bio } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.bio = bio;
    await user.save();

    // Emit socket event for real-time updates
    io.emit("userUpdated", user);

    res.json({ message: "Bio updated successfully", user });

  } catch (error) {
    console.error("Error updating bio:", error);
    res.status(500).json({ error: "Failed to update bio" });
  }
});

// Socket.IO connection handling with error handling and reconnection logic
io.on("connection", (socket) => {
  console.log("A user connected");

  // Emit online status when a user connects
  socket.broadcast.emit("userConnected", socket.id);

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", reason);
    // Emit offline status when a user disconnects
    socket.broadcast.emit("userDisconnected", socket.id);

    if (reason === "io server disconnect") {
      // Reconnect if server initiated disconnect
      socket.connect();
    }
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("Socket reconnected after", attemptNumber, "attempts");
  });

  // Handle joining a chat room
  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
  });

  // Handle leaving a chat room
  socket.on("leaveChat", (chatId) => {
    socket.leave(chatId);
  });
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
