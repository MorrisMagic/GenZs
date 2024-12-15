import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";

function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [activeUsers, setActiveUsers] = useState(new Set());
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }

    // Connect to Socket.IO
    socketRef.current = io("http://localhost:5000", {
      withCredentials: true,
      auth: {
        token: localStorage.getItem("token"),
      },
    });

    // Listen for new messages
    socketRef.current.on(`chat-${userId}`, (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Listen for new posts
    socketRef.current.on("postSent", (data) => {
      if (data.recipientId === userId) {
        setMessages((prev) => [...prev, data.post]);
      }
    });

    // Listen for user status updates
    socketRef.current.on("userConnected", (connectedUserId) => {
      setActiveUsers((prev) => new Set([...prev, connectedUserId]));
    });

    socketRef.current.on("userDisconnected", (disconnectedUserId) => {
      setActiveUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(disconnectedUserId);
        return newSet;
      });
    });

    // Listen for connection errors
    socketRef.current.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setError("Failed to connect to chat server");
    });

    // Fetch users that follow each other
    const fetchUsers = async () => {
      try {
        const response = await fetch(`http://localhost:5000/user/${userId}`, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch users");
        }

        const userData = await response.json();

        // Get mutual followers by finding users who are both in following and followers arrays
        const mutualFollows = [];
        if (userData.following && userData.followers) {
          for (let followedUser of userData.following) {
            if (
              userData.followers.find((follower) => follower === followedUser)
            ) {
              try {
                const userResponse = await fetch(
                  `http://localhost:5000/user/${followedUser}`,
                  {
                    credentials: "include",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                  }
                );
                if (userResponse.ok) {
                  const userDetails = await userResponse.json();
                  mutualFollows.push(userDetails);
                }
              } catch (error) {
                console.error(`Error fetching user details: ${error}`);
              }
            }
          }
        }

        setUsers(mutualFollows);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        setError(err.message || "Failed to fetch users");
      }
    };

    fetchUsers();

    // Notify server of user online status
    const notifyOnlineStatus = async () => {
      try {
        await fetch(`http://localhost:5000/api/users/online`, {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        });
        socketRef.current.emit("user-online", userId);
      } catch (err) {
        console.error("Failed to notify online status:", err);
      }
    };

    notifyOnlineStatus();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Notify server of user offline status
      const notifyOfflineStatus = async () => {
        try {
          await fetch(`http://localhost:5000/api/users/offline`, {
            method: "POST",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId }),
          });
          socketRef.current.emit("user-offline", userId);
        } catch (err) {
          console.error("Failed to notify offline status:", err);
        }
      };

      notifyOfflineStatus();
    };
  }, [userId, navigate]);

  const fetchMessages = async (recipientId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/messages/${recipientId}`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch messages");
      }
      const data = await response.json();
      setMessages(data);
      setError("");
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setError(err.message || "Failed to fetch messages");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
    } else {
      setError("Please select an image file");
    }
  };

  const onEmojiClick = (emojiObject) => {
    setNewMessage((prevMessage) => prevMessage + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!selectedImage && !newMessage.trim()) || !selectedUser) return;

    try {
      const formData = new FormData();
      if (newMessage.trim()) {
        formData.append("content", newMessage);
      }
      if (selectedImage) {
        formData.append("image", selectedImage);
      }

      const response = await fetch(
        `http://localhost:5000/messages/${selectedUser._id}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send message");
      }

      const sentMessage = await response.json();
      setMessages((prev) => [...prev, sentMessage]);
      setNewMessage("");
      setSelectedImage(null);
      setError("");

      socketRef.current.emit("new-message", {
        recipientId: selectedUser._id,
        message: sentMessage,
      });

      socketRef.current.emit("postSent", {
        recipientId: selectedUser._id,
        post: sentMessage,
      });

      // Display the sent message
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err.message || "Failed to send message");
    }
  };
  return (
    <div className="flex min-h-screen bg-myblack text-gray-100 md:pl-[280px] lg:pl-[300px]">
      <div className="w-full h-screen">
        <div className="flex h-full border bg-myblack">
          {/* Left sidebar */}
          <div className="hidden md:flex w-[280px] lg:w-[300px] border-r bg-myblack flex-col">
            <div className="p-4 border-b bg-myblack">
              <h2 className="text-lg font-semibold">Messages</h2>
            </div>
            <div className="overflow-y-auto flex-1">
              {users.map((user) => (
                <div
                  key={user._id}
                  onClick={() => {
                    setSelectedUser(user);
                    fetchMessages(user._id);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-700 transition-colors
                    ${selectedUser?._id === user._id ? "bg-gray-700" : ""}`}
                >
                  <div className="flex items-center">
                    <div className="relative">
                      <img
                        src={
                          user.profilePicture ||
                          "https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg"
                        }
                        alt={user.username}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
                      />
                      {activeUsers.has(user._id) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="font-semibold">{user.username}</div>
                      <div className="text-sm text-gray-400">
                        {activeUsers.has(user._id) ? "Active now" : "Offline"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col bg-myblack">
            {selectedUser ? (
              <>
                {/* Chat header */}
                <div className="p-4 border-b bg-myblack flex items-center">
                  <img
                    src={
                      selectedUser.profilePicture ||
                      "https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg"
                    }
                    alt={selectedUser.username}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
                  />
                  <div className="ml-3">
                    <div className="font-semibold">{selectedUser.username}</div>
                    <div className="text-sm text-gray-400">
                      {activeUsers.has(selectedUser._id)
                        ? "Active now"
                        : "Offline"}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-myblack">
                  {messages.map((message, index) => (
                    <div
                      key={message._id || index}
                      className={`flex mb-4 ${
                        message.sender === userId ||
                        message.sender._id === userId
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[60%] ${
                          message.sender === userId ||
                          message.sender._id === userId
                            ? "bg-blue-600 text-white rounded-[20px] rounded-tr-[5px]"
                            : "bg-gray-700 text-gray-100 rounded-[20px] rounded-tl-[5px]"
                        } px-3 py-2 md:px-4 md:py-2`}
                      >
                        {message.post?.author && (
                          <div className="flex items-center mb-2">
                            <img
                              src={message.post.author.profilePicture}
                              alt="Post author"
                              className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover"
                            />
                            <p className="ml-2 md:ml-3 font-semibold text-sm md:text-base">
                              {message.post.author.username}
                            </p>
                          </div>
                        )}

                        {message.content && (
                          <p className="mb-2 text-sm md:text-base">{message.content}</p>
                        )}
                        {message.post && (
                          <p className="mb-2 text-sm md:text-base">{message.post.content}</p>
                        )}
                        {message.post?.imageUrl && (
                          <div className="relative">
                            <img
                              src={message.post?.imageUrl}
                              alt="Post attachment"
                              className="w-full rounded-lg"
                              onClick={() =>
                                navigate(`/posts/${message.post._id}`)
                              }
                            />
                            <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white p-2 w-full rounded-b-lg">
                              <p className="text-xs md:text-sm">{message.post.content}</p>
                            </div>
                          </div>
                        )}
                        {message.imageUrl && (
                          <img
                            src={message.imageUrl}
                            alt="Message attachment"
                            className="max-w-full rounded-lg mt-2"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <form
                  onSubmit={sendMessage}
                  className="p-2 md:p-4 border-t bg-myblack"
                >
                  <div className="flex items-center gap-1 md:gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1 md:p-2 hover:bg-gray-700 rounded-full"
                    >
                      😊
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 p-2 border border-gray-600 rounded-full focus:outline-none bg-gray-700 text-gray-100 text-sm md:text-base"
                      placeholder="Message..."
                    />
                    <label className="p-1 md:p-2 hover:bg-gray-700 rounded-full cursor-pointer">
                      📎
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="submit"
                      className="text-blue-400 font-semibold px-2 md:px-4 text-sm md:text-base disabled:opacity-50"
                      disabled={!newMessage.trim() && !selectedImage}
                    >
                      Send
                    </button>
                  </div>

                  {showEmojiPicker && (
                    <div className="absolute bottom-20 right-0 md:right-auto">
                      <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
                    </div>
                  )}

                  {selectedImage && (
                    <div className="mt-2 p-2 border bg-myblack rounded-lg bg-gray-700">
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        alt="Selected"
                        className="h-16 md:h-20 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="text-red-400 ml-2 hover:text-red-500 text-sm md:text-base"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm md:text-base">
                Select a conversation to start messaging
              </div>
            )}
            {error && <div className="p-4 text-red-400 text-sm md:text-base">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
