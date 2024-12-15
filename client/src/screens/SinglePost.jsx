import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { BsArrowLeft } from "react-icons/bs";
import io from "socket.io-client";
import Posts from "../components/Posts";

const SinglePost = () => {
  const [post, setPost] = useState(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const { postId } = useParams();
  const navigate = useNavigate(); // Using navigate hook here
  const socketRef = useRef();

  // Fetch post and user on mount
  useEffect(() => {
    const fetchPostAndUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const [postResponse, userResponse] = await Promise.all([
          axios.get(`http://localhost:5000/posts/${postId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/auth/user", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setPost(postResponse.data);
        setUser(userResponse.data);
        setIsSaved(postResponse.data.savedBy.includes(userResponse.data._id));
      } catch (err) {
        setError(err.response?.data?.error || "Failed to fetch data");
      }
    };

    fetchPostAndUser();
  }, [postId, navigate]);

  // Socket connection for real-time updates
  useEffect(() => {
    if (!user || !post) return;

    socketRef.current = io("http://localhost:5000", {
      withCredentials: true,
      auth: { token: localStorage.getItem("token") },
    });

    socketRef.current.on("postUpdated", (updatedPost) => {
      setPost(updatedPost);
      setIsSaved(updatedPost.savedBy.includes(user._id));
    });

    socketRef.current.on(`commentAdded-${postId}`, (newComment) => {
      setPost((prevPost) => ({
        ...prevPost,
        comments: [...prevPost.comments, newComment],
      }));
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [user, post, postId]);

  // Add comment handler
  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `http://localhost:5000/posts/${postId}/comments`,
        { content: comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setComment("");
      toast.success("Comment added successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add comment");
      toast.error("Failed to add comment");
    }
  };

  // Like post handler
  const handleLike = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `http://localhost:5000/posts/${postId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update like");
      toast.error("Failed to update like");
    }
  };

  // Save/Unsave post handler
  const handleSavePost = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/save`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const saved = response.data.saved;
      setIsSaved(saved);

      if (saved) {
        toast.success("Post saved!");
      } else {
        toast.success("Post unsaved!");
      }
    } catch (err) {
      toast.error("Failed to save/unsave post");
    }
  };

  // Delete post handler (this is where we need proper navigation after success)
  const handleDeletePost = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // If post is deleted, navigate to the home page
      toast.success("Post deleted successfully!");
      navigate("/"); // This will redirect to the home page
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete post");
      toast.error("Failed to delete post");
    }
  };

  // Delete comment handler
  const handleDeleteComment = async (commentId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `http://localhost:5000/posts/${postId}/comments/${commentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Comment deleted successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete comment");
      toast.error("Failed to delete comment");
    }
  };

  if (!post)
    return (
      <div className="flex justify-center items h-screen bg-myblack text-white">
        Loading...
      </div>
    );

  return (
    <div className="min-h-screen bg-myblack text-white flex justify-center ">
      <div className="w-full max-w-2xl mx-auto p-4">
        {error && <div className="mb-4 text-red-500 text-center">{error}</div>}
        <button
          onClick={() => navigate("/")}
          className="mb-4 px-4 py-2  text-white"
        >
          <p className="flex items-center">
            <BsArrowLeft className="mr-2" /> Back to Home
          </p>
        </button>
        <Posts
          posts={[post]}
          user={user}
          onLike={handleLike}
          onDelete={handleDeletePost}
          onDeleteComment={handleDeleteComment}
          onComment={handleComment}
          comment={comment}
          setComment={setComment}
          isSaved={isSaved}
        />
      </div>
    </div>
  );
};

export default SinglePost;
