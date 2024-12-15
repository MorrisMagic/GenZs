import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Posts from "../components/Posts";
import { toast } from "react-toastify";

function Hashtag() {
  const { hashtag } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserAndPostsByHashtag = async () => {
      try {
        const token = localStorage.getItem("token");
        const userResponse = await axios.get("/api/auth/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUser(userResponse.data);

        const postsResponse = await axios.get(`/api/hashtags/${hashtag}`);
        setPosts(postsResponse.data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndPostsByHashtag();
  }, [hashtag]);

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/like`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPosts((prevPosts) =>
        prevPosts.map((post) => (post._id === postId ? response.data : post))
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update like");
      toast.error("Failed to update like");
    }
  };

  const handleSave = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/save`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPosts((prevPosts) =>
        prevPosts.map((post) => (post._id === postId ? response.data : post))
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save post");
      toast.error("Failed to save post");
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setPosts((prevPosts) => prevPosts.filter((post) => post._id !== postId));
      toast.success("Post deleted successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete post");
      toast.error("Failed to delete post");
    }
  };

  const handleComment = async (postId, comment) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/comments`,
        { comment },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPosts((prevPosts) =>
        prevPosts.map((post) => (post._id === postId ? response.data : post))
      );
      setComment("");
      toast.success("Comment added successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add comment");
      toast.error("Failed to add comment");
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `http://localhost:5000/posts/${postId}/comments/${commentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPosts((prevPosts) =>
        prevPosts.map((post) => (post._id === postId ? response.data : post))
      );
      toast.success("Comment deleted successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete comment");
      toast.error("Failed to delete comment");
    }
  };

  return (
    <div className="w-full mx-auto bg-myblack h-screen py-4 px-4 sm:px-6 ">
      <div className="bg-mygray max-w-3xl mx-auto rounded-xl p-4 mb-6">
        <h1 className="text-2xl  font-semibold mb-4 text-white">#{hashtag}</h1>
        {error && <div className="mb-4 text-red-500 text-center">{error}</div>}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <Posts
            posts={posts}
            user={user}
            onLike={handleLike}
            onSave={handleSave}
            onDelete={handleDeletePost}
            onComment={handleComment}
            onDeleteComment={handleDeleteComment}
            comment={comment}
            setComment={setComment}
          />
        )}
      </div>
    </div>
  );
}

export default Hashtag;
