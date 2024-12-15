import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import Posts from "../components/Posts";

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mentions, setMentions] = useState([]);
  const [hashtags, setHashtags] = useState([]);

  // Initialize socket connection only once
  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    // Socket.io event listeners
    newSocket.on("newPost", (post) => {
      setPosts((prevPosts) => [post, ...prevPosts]);
    });

    newSocket.on("postUpdated", (updatedPost) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    });

    newSocket.on("postDeleted", (postId) => {
      setPosts((prevPosts) => prevPosts.filter((post) => post._id !== postId));
    });

    newSocket.on("newRepost", async (repostId) => {
      try {
        const response = await axios.get(
          `http://localhost:5000/posts/${repostId}`,
          { withCredentials: true }
        );
        setPosts((prevPosts) => [response.data, ...prevPosts]);
      } catch (err) {
        console.error("Error fetching repost:", err);
      }
    });

    newSocket.on("newNotification", (notification) => {
      // Handle new notification in real-time
      if (notification.recipientId === user?._id) {
        // You can add notification handling logic here
        // For example, show a toast notification
        console.log("New notification received:", notification);
      }
    });

    newSocket.on("notificationCleared", (data) => {
      // Handle cleared notification in real-time
      if (data.userId === user?._id) {
        // Update notifications state if needed
        console.log("Notification cleared:", data.notificationId);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user?._id]);

  // Fetch user and initial posts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get("/api/auth/user", {
          withCredentials: true,
        });
        setUser(response.data);
      } catch (err) {
        navigate("/login");
      }
    };

    const fetchPosts = async () => {
      try {
        const response = await axios.get("http://localhost:5000/posts", {
          withCredentials: true,
        });
        setPosts(response.data);
      } catch (err) {
        console.error("Error fetching posts:", err);
      }
    };

    checkAuth();
    fetchPosts();
  }, [navigate]);

  // Fetch mentions after user is set
  useEffect(() => {
    if (user) {
      const fetchMentions = async () => {
        try {
          const response = await axios.get(
            `/api/user/mentions/${user.username}`,
            { withCredentials: true }
          );
          if (response.data.length > 0) {
            setMentions(response.data);
          }
        } catch (err) {
          console.error("Error fetching mentions:", err);
        }
      };

      fetchMentions();
    }
  }, [user]);

  // Fetch hashtags after user is set
  useEffect(() => {
    if (user) {
      const fetchHashtags = async () => {
        try {
          const response = await axios.get(`/api/hashtags/trending`, {
            withCredentials: true,
          });
          if (response.data.length > 0) {
            setHashtags(response.data);
          }
        } catch (err) {
          console.error("Error fetching hashtags:", err);
        }
      };

      fetchHashtags();
    }
  }, [user]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handlePostChange = (e) => {
    setNewPost(e.target.value);
  };

  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !image) return;

    if (image && image.size > 5 * 1024 * 1024) {
      alert("Image size exceeds 5MB!");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("content", newPost);
      if (image) formData.append("image", image);

      await axios.post("http://localhost:5000/posts", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      setNewPost("");
      setImage(null);
    } catch (err) {
      console.error("Error creating post:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await axios.post(
        `http://localhost:5000/posts/${postId}/like`,
        {},
        { withCredentials: true }
      );
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  return (
    <div className="min-h-screen bg-myblack text-white">
      <div className="max-w-xl mx-auto py-4 px-4">
        <div className="bg-mygray rounded-lg p-4 mb-4">
          <form onSubmit={handleSubmitPost} className="space-y-3">
            <div className="flex gap-3">
              <img
                src={user?.profilePicture || `https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg`}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="flex-1">
                <textarea
                  className="w-full bg-transparent border-none resize-none focus:outline-none focus:ring-0 placeholder-gray-500 text-white min-h-[60px]"
                  placeholder="Start a thread..."
                  value={newPost}
                  onChange={handlePostChange}
                />
                <div className="whitespace-pre-wrap">
                  {newPost.split(/(@\w+|#\w+)/).map((part, index) => {
                    if (part.startsWith('@')) {
                      return <span key={index} className="text-blue-400">{part}</span>;
                    }
                    if (part.startsWith('#')) {
                      return <span key={index} className="text-green-400">{part}</span>;
                    }
                    return part;
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-700 pt-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400 hover:text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </label>

              {image && (
                <span className="text-xs text-gray-400 truncate max-w-[150px]">
                  {image.name}
                </span>
              )}

              <button
                type="submit"
                className="px-3 py-1 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newPost.trim() && !image || loading}
              >
                {loading ? "..." : "Post"}
              </button>
            </div>
          </form>
        </div>

        <Posts posts={posts} onLike={handleLike} user={user} />
      </div>
    </div>
  );
};

export default Home;
