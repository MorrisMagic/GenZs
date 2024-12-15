import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const LeftBar = () => {
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTrendingHashtags = async () => {
    try {
      const response = await axios.get("/api/hashtags");
      if (Array.isArray(response.data)) {
        setTrendingHashtags(response.data);
      } else {
        console.error("Unexpected response format:", response.data);
      }
    } catch (err) {
      console.error("Error fetching trending hashtags:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedUsers = async () => {
    try {
      const response = await axios.get("/api/suggested");
      setSuggestedUsers(response.data);
    } catch (err) {
      console.error("Error fetching suggested users:", err);
    }
  };

  useEffect(() => {
    fetchTrendingHashtags();
    fetchSuggestedUsers();
  }, []);

  return (
    <div className="fixed right-0 top-0 w-full sm:w-1/4 border-l border-gray-800 bg-myblack h-full py-4 px-4 sm:px-6">
      <div className="max-w-xs p-4 mx-auto">
        <h1 className="text-sm font-semibold text-gray-400 mb-4">
          Suggested for you
        </h1>
        <ul className="space-y-3">
          {suggestedUsers
            .filter((user) => user._id !== localStorage.getItem("userId"))
            .map((user) => (
              <li
                key={user._id}
                className="flex items-center justify-between cursor-pointer hover:bg-opacity-10 hover:bg-white p-2 rounded-lg transition"
                onClick={() => navigate(`/profile/${user._id}`)}
              >
                <div className="flex items-center space-x-3">
                  <img
                    src={
                      user.profilePicture || "https://via.placeholder.com/40"
                    }
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-white font-medium text-sm">
                      {user.username}
                    </p>
                    <p className="text-gray-400 text-xs">Suggested for you</p>
                  </div>
                </div>
                <button className="text-blue-500 text-xs font-semibold hover:text-blue-400">
                  Follow
                </button>
              </li>
            ))}
        </ul>
      </div>
      <div className="bg-mygray max-w-xs mx-auto rounded-xl p-4 mb-6">
        <h2 className="text-xl font-bold mb-4 text-white">What's happening</h2>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="space-y-2">
            {trendingHashtags.map((hashtag, index) => (
              <div
                key={index}
                className="py-3 px-4 hover:bg-gray-800 transition cursor-pointer rounded-lg"
                onClick={() => navigate(`/hashtag/${hashtag.substring(1)}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs">Trending</p>
                    <p className="text-white font-bold text-sm">{hashtag}</p>
                  </div>
                  <div className="text-gray-500 hover:text-blue-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftBar;
