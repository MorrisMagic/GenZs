import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { LuSend } from "react-icons/lu";
import { AiOutlineHeart, AiFillHeart, AiOutlineComment } from "react-icons/ai";
import { IoBookmark } from "react-icons/io5";
import { toast } from "react-toastify";
import io from "socket.io-client";

const Post = ({ post, onLike, user, onDelete = () => {}, onSave }) => {
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(
    post.savedBy ? post.savedBy.includes(user?._id) : false
  );
  const [isLiked, setIsLiked] = useState(
    post.likes ? post.likes.includes(user?._id) : false
  );
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [mentionedUserIds, setMentionedUserIds] = useState({});
  const [validUsernames, setValidUsernames] = useState({});
  const [hoverProfileData, setHoverProfileData] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [hashtags, setHashtags] = useState([]);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Extract mentions and hashtags from post content
    if (post.content) {
      const mentionRegex = /@(\w+)/g;
      const hashtagRegex = /#(\w+)/g;
      const mentionMatches = post.content.match(mentionRegex) || [];
      const hashtagMatches = post.content.match(hashtagRegex) || [];
      const usernames = mentionMatches.map((mention) => mention.substring(1));
      const tags = hashtagMatches.map((hashtag) => hashtag.substring(1));
      setMentionedUsers(usernames);
      setHashtags(tags);

      // Fetch user IDs for mentioned usernames
      const fetchUserIds = async () => {
        const userIdMap = {};
        const validUsernamesMap = {};
        for (const username of usernames) {
          try {
            const response = await axios.get(
              `/api/users/username/${username}`,
              {
                withCredentials: true,
              }
            );
            if (response.data && response.data._id) {
              userIdMap[username] = response.data._id;
              validUsernamesMap[username] = true;
            } else {
              validUsernamesMap[username] = false;
            }
          } catch (err) {
            console.error(`Error fetching user ID for ${username}:`, err);
            validUsernamesMap[username] = false;
          }
        }
        setMentionedUserIds(userIdMap);
        setValidUsernames(validUsernamesMap);
      };

      fetchUserIds();
    }
  }, [post.content]);

  useEffect(() => {
    const socket = io("http://localhost:5000", {
      withCredentials: true,
    });

    socket.on("postUpdated", (updatedPost) => {
      if (updatedPost._id === post._id) {
        setIsSaved(
          updatedPost.savedBy ? updatedPost.savedBy.includes(user?._id) : false
        );
        setIsLiked(
          updatedPost.likes ? updatedPost.likes.includes(user?._id) : false
        );
      }
    });

    socket.on("postDeleted", (deletedPostId) => {
      if (deletedPostId === post._id) {
        onDelete(deletedPostId);
      }
    });

    return () => socket.disconnect();
  }, [post._id, user?._id, onDelete]);

  useEffect(() => {
    setIsSaved(post.savedBy ? post.savedBy.includes(user?._id) : false);
    setIsLiked(post.likes ? post.likes.includes(user?._id) : false);
  }, [post, user?._id]);

  useEffect(() => {
    if (location.pathname.includes("/posts/")) {
      setShowComments(true);
    }
  }, [location.pathname]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await axios.post(
        `/posts/${post._id}/comments`,
        {
          content: comment,
        },
        {
          withCredentials: true,
        }
      );
      setComment("");
      toast.success("Comment added successfully!");
    } catch (err) {
      console.error("Error adding comment:", err);
      toast.error("Failed to add comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(`/posts/${post._id}/comments/${commentId}`, {
        withCredentials: true,
      });
      toast.success("Comment deleted successfully!");
    } catch (err) {
      console.error("Error deleting comment:", err);
      toast.error("Failed to delete comment");
    }
  };

  const handleDeletePost = async (e) => {
    e.stopPropagation();
    try {
      const response = await axios.delete(`/posts/${post._id}`, {
        withCredentials: true,
      });
      if (response.status === 200) {
        const socket = io("http://localhost:5000", {
          withCredentials: true,
        });
        socket.emit("deletePost", post._id);
        onDelete(post._id);
        toast.success("Post deleted successfully!");
      }
    } catch (err) {
      console.error("Error deleting post:", err);
      toast.error("Failed to delete post");
    }
  };

  const handleSavePost = async (e) => {
    e.stopPropagation();
    try {
      const response = await axios.post(
        `/posts/${post._id}/save`,
        {},
        {
          withCredentials: true,
        }
      );

      if (onSave) {
        onSave(post._id);
      }

      setIsSaved(response.data.saved);
      toast.success(response.data.saved ? "Post saved" : "Post unsaved");
    } catch (err) {
      toast.error("Failed to save post");
    }
  };

  const handlePostClick = () => {
    navigate(`/posts/${post._id}`);
  };

  const handleUsernameClick = (e, authorId) => {
    e.stopPropagation();
    if (authorId) {
      navigate(`/profile/${authorId}`);
    }
  };

  const handleLikePost = useCallback(
    async (e) => {
      e.stopPropagation();
      setIsLiked((prev) => !prev);
      onLike(post._id);
    },
    [onLike, post._id]
  );

  const handleMentionHover = async (e, username, userId) => {
    if (!userId) return;

    try {
      const response = await axios.get(`/api/users/${username}`, {
        withCredentials: true,
      });

      if (!response.data) {
        console.error("User not found");
        return;
      }

      setHoverProfileData(response.data);

      // Calculate position relative to viewport
      const rect = e.target.getBoundingClientRect();
      const x = rect.left;
      const y = rect.bottom;

      // Adjust position to keep card within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y + 5; // Add small gap

      // If card would go off right edge, show it to the left instead
      if (x + 300 > viewportWidth) {
        // Assuming card width is 300px
        adjustedX = viewportWidth - 310; // Leave 10px margin
      }

      // If card would go off bottom, show it above the mention
      if (y + 200 > viewportHeight) {
        // Assuming card height is 200px
        adjustedY = rect.top - 205; // Show above with 5px gap
      }

      setHoverPosition({ x: adjustedX, y: adjustedY });
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setHoverProfileData(null);
    }
  };

  const handleMentionLeave = () => {
    setHoverProfileData(null);
  };

  const renderContent = (content) => {
    if (!content) return null;

    return content.split(/(@\w+|#\w+)/).map((part, index) => {
      if (part.startsWith("@")) {
        const username = part.substring(1);
        const userId = mentionedUserIds[username];
        const isValidUser = validUsernames[username];

        if (!isValidUser) {
          return (
            <span key={index} className="text-gray-200">
              {part}
            </span>
          );
        }

        return (
          <span
            key={index}
            className="text-blue-400 hover:underline cursor-pointer relative"
            onClick={(e) => {
              e.stopPropagation();
              if (userId) {
                navigate(`/profile/${userId}`);
              }
            }}
            onMouseEnter={(e) => handleMentionHover(e, username, userId)}
            onMouseLeave={handleMentionLeave}
          >
            {part}
          </span>
        );
      } else if (part.startsWith("#")) {
        const hashtag = part.substring(1);
        return (
          <span
            key={index}
            className="text-green-400 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/hashtag/${hashtag}`);
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleSendClick = async (e) => {
    e.stopPropagation();
    try {
      const response = await axios.get(`/api/users/${user._id}/following`, {
        withCredentials: true,
      });
      setFollowers(response.data);
      setShowFollowersModal(true);
    } catch (err) {
      console.error("Error fetching followers:", err);
      toast.error("Failed to fetch followers");
    }
  };

  const handleSendPost = async (follower) => {
    try {
      await axios.post(
        `/api/messages/send`,
        {
          recipientId: follower._id,
          postId: post._id,
        },
        {
          withCredentials: true,
        }
      );
      toast.success("Post sent successfully!");
      setShowFollowersModal(false);
    } catch (err) {
      console.error("Error sending post:", err);
      toast.error("Failed to send post");
    }
  };

  const sendPostToFollower = async (followerId, postId) => {
    try {
      const response = await axios.post(`/api/messages/sendPost`, {
        senderId: user._id,
        recipientId: followerId,
        postId: postId,
      });

      // Emit event to notify the follower in real-time
      const socket = io("http://localhost:5000", {
        withCredentials: true,
      });

      socket.emit("postSent", {
        recipientId: followerId,
        post: response.data,
      });

      toast.success("Post sent successfully!");
    } catch (err) {
      console.error("Error sending post:", err);
      toast.error("Failed to send post");
    }
  };

  return (
    <div
      className="bg-mygray rounded-lg p-4 md:p-6 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer relative"
      onClick={handlePostClick}
    >
      {hoverProfileData && (
        <div
          className="fixed z-50 bg-myblack rounded-lg p-4 shadow-lg border border-gray-700"
          style={{
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y}px`,
            width: "300px",
          }}
        >
          <div className="flex items-center space-x-3">
            <img
              src={
                hoverProfileData.profilePicture ||
                `https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg`
              }
              alt={hoverProfileData.username}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h3 className="font-bold text-white">
                {hoverProfileData.username}
              </h3>
              <p className="text-gray-400 text-sm">
                {hoverProfileData.bio || "No bio available"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex space-x-4 text-sm text-gray-400">
            <span>{hoverProfileData?.followersCount || 0} followers</span>
            <span>{hoverProfileData?.followingCount || 0} following</span>
          </div>
          <div className="mt-3">
            <button
              className="w-full py-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${hoverProfileData._id}`);
              }}
            >
              View Profile
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <img
            className="h-10 w-10 rounded-full object-cover"
            src={
              post.author?.profilePicture ||
              `https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg`
            }
            alt={post.author?.username}
          />
          <div className="ml-3">
            <p
              className="font-medium text-gray-200 hover:text-blue-400 cursor-pointer"
              onClick={(e) => handleUsernameClick(e, post.author?._id)}
            >
              {post.author?.username}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {user?._id === post.author?._id && (
          <button
            onClick={handleDeletePost}
            className="text-red-500 hover:text-red-400"
          >
            Delete
          </button>
        )}
      </div>

      <p className="text-gray-200 mb-4">{renderContent(post.content)}</p>

      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt="Post content"
          className="rounded-lg max-h-96 w-full object-contain mb-4"
        />
      )}

      <div className="flex items-center space-x-6 text-sm text-gray-400">
        <button
          onClick={handleLikePost}
          className={`flex items-center space-x-2 hover:text-red-500 ${
            isLiked ? "text-red-500" : ""
          }`}
        >
          {isLiked ? (
            <AiFillHeart className="w-5 h-5" />
          ) : (
            <AiOutlineHeart className="w-5 h-5" />
          )}
          <span>{post.likes?.length || 0}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowComments(!showComments);
          }}
          className="flex items-center space-x-2 hover:text-blue-400"
        >
          <AiOutlineComment className="w-5 h-5" />
          <span>{post.comments?.length || 0}</span>
        </button>

        <button
          onClick={handleSavePost}
          className={`flex items-center space-x-2 hover:text-blue-400 ${
            isSaved ? "text-blue-400" : ""
          }`}
        >
          {isSaved ? (
            <IoBookmark className="w-5 h-5" />
          ) : (
            <IoBookmark className="w-5 h-5" />
          )}
        </button>
        <button
          onClick={handleSendClick}
          className="hover:text-blue-400 flex items-center space-x-2"
        >
          <LuSend className="w-5 h-5" />
        </button>
      </div>

      {showComments && (
        <div
          className="mt-4 border-t border-gray-800 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmitComment} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-800 text-gray-200 p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none"
              >
                Reply
              </button>
            </div>
          </form>

          <div className="space-y-4">
            {post.comments?.map((comment) => (
              <div key={comment._id} className="flex items-start space-x-3">
                <img
                  className="h-8 w-8 rounded-full object-cover"
                  src={
                    comment.author?.profilePicture ||
                    `https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg`
                  }
                  alt={comment.author?.username}
                />
                <div className="flex-1 bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <p
                      className="font-medium text-gray-200 hover:text-blue-400 cursor-pointer"
                      onClick={(e) =>
                        handleUsernameClick(e, comment.author?._id)
                      }
                    >
                      {comment.author?.username}
                    </p>
                    {user?._id === comment.author?._id && (
                      <button
                        onClick={() => handleDeleteComment(comment._id)}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-gray-300 mt-1">
                    {renderContent(comment.content)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFollowersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
          <div
            className="bg-white rounded-lg overflow-hidden shadow-lg w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-300">
              <h2 className="text-black text-lg font-semibold">Followers</h2>
              <button
                className="text-black hover:text-gray-600"
                onClick={() => setShowFollowersModal(false)}
              >
                &times;
              </button>
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {followers.map((follower) => (
                <li
                  key={follower._id}
                  className="flex items-center space-x-3 p-4 hover:bg-gray-100 cursor-pointer"
                  onClick={() => sendPostToFollower(follower._id, post._id)}
                >
                  <img
                    src={
                      follower.profilePicture ||
                      `https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg`
                    }
                    alt={follower.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <span className="text-black font-medium">
                    {follower.username}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const Posts = ({ posts, onLike, user, onDelete = () => {}, onSave }) => {
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <Post
          key={post._id}
          post={post}
          onLike={onLike}
          user={user}
          onDelete={onDelete}
          onSave={onSave}
        />
      ))}
    </div>
  );
};

export default Posts;
