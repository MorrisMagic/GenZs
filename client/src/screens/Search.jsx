import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:5000/search/users?q=${encodeURIComponent(
            searchQuery
          )}`,
          {
            credentials: "include",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to search users");
        }

        const results = await response.json();
        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search users. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(search, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-myblack text-gray-100 flex flex-col items-center">
      <div className="w-full max-w-2xl px-4 py-6">
        <div className="sticky top-0 bg-myblack z-10 pb-4 w-full">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-12 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <svg 
              className="absolute left-4 top-2.5 h-6 w-6 text-gray-400"
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-center py-4">{error}</div>
        )}

        <div className="divide-y divide-gray-800 w-full">
          {searchResults.map((user) => (
            <Link
              key={user._id}
              to={`/profile/${user._id}`}
              className="flex items-center py-3 px-4 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <img
                src={user.profilePicture || "/default-avatar.png"}
                alt={user.username}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="ml-4 flex-1 min-w-0">
                <div className="flex items-center">
                  <h3 className="font-semibold text-base truncate">{user.username}</h3>
                  {user.verified && (
                    <svg
                      className="w-5 h-5 ml-2 text-blue-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <p className="text-gray-400 text-sm truncate">{user.name}</p>
                {user.bio && (
                  <p className="text-gray-500 text-sm mt-1 truncate">{user.bio}</p>
                )}
              </div>
            </Link>
          ))}
        </div>

        {searchQuery && !loading && searchResults.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            No results found for "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

export default Search;
