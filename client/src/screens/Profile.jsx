  import React, { useState, useEffect } from "react";
  import axios from "axios";
  import { useParams } from "react-router-dom";
  import { useNavigate } from "react-router-dom";
  import io from "socket.io-client";
  import Posts from "../components/Posts";

  function Profile() {
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [posts, setPosts] = useState([]);
    const [comments, setComments] = useState({});
    const [showComments, setShowComments] = useState({});
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const { userId } = useParams();
    const navigate = useNavigate();
    const myId = localStorage.getItem("userId");

    useEffect(() => {
      const socket = io("http://localhost:5000", {
        withCredentials: true,
      });

      socket.on("userUpdated", (updatedUser) => {
        if (updatedUser._id === user?._id) {
          setUser(updatedUser);
        }
      });

      socket.on("postUpdated", (updatedPost) => {
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post._id === updatedPost._id ? updatedPost : post
          )
        );
      });

      socket.on("postDeleted", (deletedPostId) => {
        setPosts((prevPosts) =>
          prevPosts.filter((post) => post._id !== deletedPostId)
        );
      });

      return () => {
        socket.disconnect();
      };
    }, [user]);

    useEffect(() => {
      const fetchProfile = async () => {
        try {
          // Get the profile data for the requested userId
          const endpoint = userId
            ? `http://localhost:5000/user/${userId}`
            : "http://localhost:5000/user";

          const response = await axios.get(endpoint, {
            withCredentials: true,
          });
          setUser(response.data);

          // Fetch followers and following details
          const followersResponse = await axios.get(
            `http://localhost:5000/user/${userId || response.data._id}/followers`,
            {
              withCredentials: true,
            }
          );
          setFollowers(followersResponse.data);

          const followingResponse = await axios.get(
            `http://localhost:5000/user/${userId || response.data._id}/following`,
            {
              withCredentials: true,
            }
          );
          setFollowing(followingResponse.data);

          // Fetch user's posts
          const postsResponse = await axios.get(
            `http://localhost:5000/user/${userId || response.data._id}/posts`,
            {
              withCredentials: true,
            }
          );
          setPosts(postsResponse.data);

          // Update user with correct posts count
          setUser((prev) => ({
            ...prev,
            postsCount: postsResponse.data.length,
          }));

          // Initialize comments state
          const commentsObj = {};
          const showCommentsObj = {};
          postsResponse.data.forEach((post) => {
            commentsObj[post._id] = "";
            showCommentsObj[post._id] = false;
          });
          setComments(commentsObj);
          setShowComments(showCommentsObj);

          // If no userId is provided, this is the logged-in user's profile
          if (!userId) {
            setIsOwnProfile(true);
          } else {
            // Get the current logged-in user to compare IDs
            const currentUserResponse = await axios.get("/api/auth/user", {
              withCredentials: true,
            });
            setIsOwnProfile(currentUserResponse.data._id === userId);
            // Check if current user is following this profile
            setIsFollowing(
              response.data.followers.includes(currentUserResponse.data._id)
            );
          }
        } catch (err) {
          setError(err.response?.data?.error || "Failed to fetch profile");
        }
      };

      fetchProfile();
    }, [userId]);

    const handleFileChange = (e) => {
      setSelectedFile(e.target.files[0]);
    };

    const handleUpload = async () => {
      if (!selectedFile) {
        setError("Please select a file first");
        return;
      }

      setIsUploadingImage(true);
      const formData = new FormData();
      formData.append("image", selectedFile);

      try {
        const response = await axios.post(
          "http://localhost:5000/user/profile-picture",
          formData,
          {
            withCredentials: true,
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        setUser((prev) => ({
          ...prev,
          profilePicture: response.data.profilePicture,
        }));
        setSelectedFile(null);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to update profile picture");
      } finally {
        setIsUploadingImage(false);
      }
    };

    const handleFollow = async () => {
      try {
        await axios.post(
          `http://localhost:5000/user/${user._id}/follow`,
          {},
          {
            withCredentials: true,
          }
        );
        setIsFollowing(!isFollowing);
        setUser((prev) => ({
          ...prev,
          followers: isFollowing
            ? prev.followers.filter((id) => id !== userId)
            : [...prev.followers, userId],
        }));
      } catch (err) {
        setError(err.response?.data?.error || "Failed to follow/unfollow user");
      }
    };

    const handleDeletePost = async (postId) => {
      try {
        await axios.delete(`http://localhost:5000/posts/${postId}`, {
          withCredentials: true,
        });
        setPosts((prevPosts) => prevPosts.filter((post) => post._id !== postId));
        // Update posts count after deletion
        setUser((prev) => ({
          ...prev,
          postsCount: prev.postsCount - 1,
        }));
      } catch (err) {
        setError(err.response?.data?.error || "Failed to delete post");
      }
    };

    const handleDeleteComment = async (postId, commentId) => {
      try {
        await axios.delete(
          `http://localhost:5000/posts/${postId}/comments/${commentId}`,
          {
            withCredentials: true,
          }
        );
      } catch (err) {
        setError(err.response?.data?.error || "Failed to delete comment");
      }
    };

    const handleLike = async (postId) => {
      try {
        await axios.post(
          `http://localhost:5000/posts/${postId}/like`,
          {},
          {
            withCredentials: true,
          }
        );
      } catch (err) {
        setError(err.response?.data?.error || "Failed to like post");
      }
    };

    const handleRepost = async (postId) => {
      try {
        const response = await axios.post(
          `http://localhost:5000/posts/${postId}/repost`,
          {},
          {
            withCredentials: true,
          }
        );
        setPosts((prevPosts) => {
          return prevPosts.map((post) => {
            if (post._id === postId) {
              const isReposted = post.reposts?.includes(myId);
              return {
                ...post,
                reposts: isReposted
                  ? post.reposts.filter((id) => id !== myId)
                  : [...(post.reposts || []), myId],
              };
            }
            return post;
          });
        });
      } catch (err) {
        setError(err.response?.data?.error || "Failed to repost");
      }
    };

    const handleComment = async (postId) => {
      try {
        if (!comments[postId].trim()) return;

        await axios.post(
          `http://localhost:5000/posts/${postId}/comments`,
          {
            content: comments[postId],
          },
          {
            withCredentials: true,
          }
        );

        setComments((prev) => ({
          ...prev,
          [postId]: "",
        }));
      } catch (err) {
        setError(err.response?.data?.error || "Failed to add comment");
      }
    };

    const toggleComments = (postId) => {
      setShowComments((prev) => ({
        ...prev,
        [postId]: !prev[postId],
      }));
    };

    const handleMentionHover = async (e, username, userId) => {
      try {
        const response = await axios.get(`http://localhost:5000/user/${userId}`, {
          withCredentials: true,
        });
      } catch (err) {
        console.error("Failed to fetch user information", err);
      }
    };

    const handleMentionLeave = () => {
    };

    const renderContent = (content) => {
      if (!content) return null;

      const mentionedUserIds = {};
      const validUsernames = {};

      return content.split(/(@\w+)/).map((part, index) => {
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
              className="text-blue-500 hover:underline cursor-pointer relative"
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
        }
        return part;
      });
    };

    if (error) {
      return <div className="text-red-500 text-center">{error}</div>;
    }

    if (!user) {
      return <div className="text-center">Loading...</div>;
    }
    return (
      <div className="min-h-screen bg-myblack">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row items-start gap-8 mb-12">
            {/* Profile Picture */}
            <div className="relative w-28 h-28 md:w-40 md:h-40 flex-shrink-0">
              <img
                src={
                  user.profilePicture ||
                  `https://ui-avatars.com/api/?name=${user.username}&background=random`
                }
                alt="Profile"
                className="w-full h-full rounded-full object-cover border-2 border-gray-700"
              />
              {isOwnProfile && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploadingImage}
                  />
                  <div className="bg-black bg-opacity-50 rounded-full p-2">
                    {isUploadingImage ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <h1 className="text-2xl font-light text-white">{user.username}</h1>
                {isOwnProfile ? (
                  <button
                    onClick={handleUpload}
                    disabled={isUploadingImage || !selectedFile}
                    className={`px-4 py-1.5 text-sm font-medium text-white bg-transparent border border-gray-600 rounded hover:border-gray-400 transition ${
                      (isUploadingImage || !selectedFile) && "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {isUploadingImage ? "Uploading..." : "Edit profile"}
                  </button>
                ) : (
                  <button
                    onClick={handleFollow}
                    className={`px-6 py-1.5 text-sm font-medium rounded transition ${
                      isFollowing
                        ? "bg-transparent border border-gray-600 text-white hover:border-gray-400"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                )}
              </div>

              <div className="flex gap-10 mb-6">
                <div className="text-white text-sm">
                  <span className="font-semibold">{posts.length}</span>
                  <span className="text-textgray"> posts</span>
                </div>
                <button 
                  onClick={() => setShowFollowers(true)}
                  className="text-white text-sm hover:opacity-80"
                >
                  <span className="font-semibold">{user.followers?.length || 0}</span>
                  <span className="text-textgray"> followers</span>
                </button>
                <button
                  onClick={() => setShowFollowing(true)}
                  className="text-white text-sm hover:opacity-80"
                >
                  <span className="font-semibold">{user.following?.length || 0}</span>
                  <span className="text-textgray"> following</span>
                </button>
              </div>

              <div className="text-white">
                <h2 className="font-semibold mb-1">{user.fullName}</h2>
              </div>
            </div>
          </div>

          {/* Content Tabs & Grid */}
          <div className="border-t border-gray-800">
            <div className="flex justify-center gap-12 -mt-px">
              <button className="border-t border-white text-white px-4 py-4 text-sm font-medium">
                POSTS
              </button>
            </div>
            
            <div className="mt-3">
              <Posts
                posts={posts}
                user={user}
                isOwnProfile={isOwnProfile}
                myId={myId}
                comments={comments}
                showComments={showComments}
                handleDeletePost={handleDeletePost}
                handleDeleteComment={handleDeleteComment}
                handleLike={handleLike}
                handleRepost={handleRepost}
                handleComment={handleComment}
                toggleComments={toggleComments}
                setComments={setComments}
                renderContent={renderContent}
              />
            </div>
          </div>

          {/* Modals */}
          {showFollowers && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-mygray rounded-xl p-6 w-96 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white text-xl font-semibold">Followers</h3>
                  <button
                    onClick={() => setShowFollowers(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-4">
                  {followers.map((follower) => (
                    <div
                      key={follower._id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={
                            follower.profilePicture ||
                            `https://ui-avatars.com/api/?name=${follower.username}&background=random`
                          }
                          alt={follower.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-white font-medium">
                            {follower.username}
                          </p>
                          <p className="text-textgray text-sm">
                            {follower.fullName}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/profile/${follower._id}`)}
                        className="text-blue-500 hover:text-blue-400 text-sm"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showFollowing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-mygray rounded-xl p-6 w-96 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white text-xl font-semibold">Following</h3>
                  <button
                    onClick={() => setShowFollowing(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-4">
                  {following.map((followedUser) => (
                    <div
                      key={followedUser._id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={
                            followedUser.profilePicture ||
                            `https://ui-avatars.com/api/?name=${followedUser.username}&background=random`
                          }
                          alt={followedUser.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-white font-medium">
                            {followedUser.username}
                          </p>
                          <p className="text-textgray text-sm">
                            {followedUser.fullName}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/profile/${followedUser._id}`)}
                        className="text-blue-500 hover:text-blue-400 text-sm"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  export default Profile;
