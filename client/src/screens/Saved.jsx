import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FaHeart, FaComment, FaImage } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Saved = () => {
  const [savedPosts, setSavedPosts] = useState([]);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSavedPosts = async () => {
      try {
        const response = await axios.get("http://localhost:5000/saved", {
          withCredentials: true,
        });
        setSavedPosts(response.data);
      } catch (err) {
        console.error("Error fetching saved posts:", err);
        toast.error("Failed to fetch saved posts");
      }
    };

    const fetchUser = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (userId) {
          const response = await axios.get(
            `http://localhost:5000/user/${userId}`,
            {
              withCredentials: true,
            }
          );
          setUser(response.data);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };

    fetchUser();
    fetchSavedPosts();
  }, []);

  const handleLike = async (postId) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/like`,
        {},
        {
          withCredentials: true,
        }
      );

      setSavedPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post._id === postId) {
            const isLiked = post.likes.includes(user._id);
            return {
              ...post,
              likes: isLiked
                ? post.likes.filter((id) => id !== user._id)
                : [...post.likes, user._id],
            };
          }
          return post;
        })
      );
    } catch (err) {
      console.error("Error liking post:", err);
      toast.error("Failed to like post");
    }
  };

  const handleSave = async (postId) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/save`,
        {},
        {
          withCredentials: true,
        }
      );

      setSavedPosts((prevPosts) => {
        return prevPosts.map((post) => {
          if (post._id === postId) {
            const isSaved = post.savedBy?.includes(user._id);
            return {
              ...post,
              savedBy: isSaved
                ? post.savedBy.filter((id) => id !== user._id)
                : [...(post.savedBy || []), user._id],
            };
          }
          return post;
        });
      });
    } catch (err) {
      console.error("Error saving/unsaving post:", err);
      toast.error("Failed to update saved status");
    }
  };

  const handlePostClick = (postId) => {
    navigate(`/posts/${postId}`);
  };

  return (
    <div className="min-h-screen bg-myblack text-white pl-[310px] pr-[22%]">
      <div className="max-w-[900px] mx-auto pt-8">
        <div className="border-b border-gray-800 pb-2 mb-3">
          <h1 className="text-2xl font-semibold">Saved</h1>
          <p className="text-gray-400 text-sm mt-1">
            Only you can see what you've saved
          </p>
        </div>

        {savedPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-[100px] h-[100px] rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <FaHeart className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-xl font-semibold mb-2">Save</p>
            <p className="text-gray-400 text-center max-w-[350px]">
              Save photos and videos that you want to see again. No one is
              notified, and only you can see what you've saved.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {savedPosts.map((post) => (
              <div
                key={post._id}
                className="relative aspect-square cursor-pointer group"
                onClick={() => handlePostClick(post._id)}
              >
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt="Post" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <FaImage className="w-10 h-10 text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6">
                  <span className="flex items-center text-white font-medium">
                    <FaHeart className="mr-2 w-5 h-5" /> {post.likes.length}
                  </span>
                  <span className="flex items-center text-white font-medium">
                    <FaComment className="mr-2 w-5 h-5" /> {post.comments.length}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Saved;
