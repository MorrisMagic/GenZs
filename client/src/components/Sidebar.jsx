import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";
import { BsArrowLeft } from "react-icons/bs";
import {
  BsHouseDoor,
  BsSearch,
  BsChat,
  BsBookmark,
  BsBell,
  BsPerson,
  BsPower,
} from "react-icons/bs";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unseenMessages, setUnseenMessages] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isLoggedIn = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (userId) {
        try {
          const response = await fetch(`http://localhost:5000/user/${userId}`, {
            credentials: "include",
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            const unreadNotifications =
              userData.notifications?.filter((n) => !n.read) || [];
            const messageNotifications = unreadNotifications.filter(
              (n) => n.type === "unread_message"
            );
            const unseenMessageNotifications = messageNotifications.filter(
              (n) => !n.seen
            );
            const otherNotifications = unreadNotifications.filter(
              (n) => n.type !== "unread_message"
            );
            setNotifications(userData.notifications || []);
            setUnreadCount(otherNotifications.length);
            setUnreadMessages(messageNotifications.length);
            setUnseenMessages(unseenMessageNotifications.length);
            localStorage.setItem("profilePicture", userData.profilePicture);
          }
        } catch (err) {
          console.error("Failed to fetch user:", err);
        }
      }
    };

    fetchUser();

    // Initialize socket connection
    const newSocket = io("http://localhost:5000", {
      withCredentials: true,
    });
    setSocket(newSocket);

    // Socket event listeners
    newSocket.on("connect", () => {
      console.log("Socket connected");
      // Join user's notification room
      if (userId) {
        newSocket.emit("joinNotificationRoom", userId);
      }
    });

    newSocket.on("notification", (notification) => {
      let message = "";
      switch (notification.type) {
        case "like":
          message = `${notification.from.username} liked your post`;
          break;
        case "comment":
          message = `${notification.from.username} commented on your post`;
          break;
        case "follow":
          message = `${notification.from.username} started following you`;
          break;
        case "repost":
          message = `${notification.from.username} reposted your post`;
          break;
        case "unread_message":
          message = `${notification.from.username} sent you a message`;
          break;
        default:
          message = notification.message;
      }

      // Update notifications state with new notification
      setNotifications((prev) => {
        // Check if notification already exists
        const exists = prev.some((n) => n._id === notification._id);
        if (!exists) {
          const newNotification = {
            ...notification,
            message,
            _id: notification._id || Date.now(),
            timestamp: new Date().toISOString(),
            read: false,
            seen: false,
          };
          if (notification.type === "unread_message") {
            setUnreadMessages((count) => count + 1);
            setUnseenMessages((count) => count + 1);
          } else {
            setUnreadCount((count) => count + 1);
          }
          return [newNotification, ...prev];
        }
        return prev;
      });
    });

    // Listen for notification updates
    newSocket.on("notificationUpdate", (updatedNotifications) => {
      console.log("Notifications updated:", updatedNotifications);
      setNotifications(updatedNotifications);
      const unreadNotifications = updatedNotifications.filter((n) => !n.read);
      const messageNotifications = unreadNotifications.filter(
        (n) => n.type === "unread_message"
      );
      const unseenMessageNotifications = messageNotifications.filter(
        (n) => !n.seen
      );
      const otherNotifications = unreadNotifications.filter(
        (n) => n.type !== "unread_message"
      );
      setUnreadCount(otherNotifications.length);
      setUnreadMessages(messageNotifications.length);
      setUnseenMessages(unseenMessageNotifications.length);
    });

    // Cleanup
    return () => {
      if (newSocket) {
        newSocket.emit("leaveNotificationRoom", userId);
        newSocket.disconnect();
      }
    };
  }, [userId]);

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:5000/logout", {
        method: "POST",
        credentials: "include",
      });
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("profilePicture");
      setUser(null);
      setNotifications([]);
      setUnreadCount(0);
      setUnreadMessages(0);
      setUnseenMessages(0);
      if (socket) {
        socket.disconnect();
      }
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleProfileClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    } else {
      navigate("/login");
    }
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-50 text-white hover:text-gray-300 transition-colors"
      >
        <BsArrowLeft className="h-6 w-6" />
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-[280px] lg:w-[300px] bg-myblack text-white shadow-lg border-r border-gray-700 transition-all duration-300 ease-in-out z-40
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 overflow-y-auto`}
      >
        <div className="flex flex-col h-full p-4 md:p-6">
          <Link
            to="/"
            className="text-2xl md:text-3xl font-bold text-white p-2 block mb-6 md:mb-8"
          >
            GenZ
          </Link>

          {isLoggedIn ? (
            <nav className="flex-1">
              <div className="space-y-6 md:space-y-8">
                <Link
                  to="/"
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                    location.pathname === "/"
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <BsHouseDoor className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-base md:text-lg">Home</span>
                </Link>

                <Link
                  to="/search"
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                    location.pathname === "/search"
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <BsSearch className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-base md:text-lg">Search</span>
                </Link>

                <Link
                  to="/chat"
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                    location.pathname === "/chat"
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <div className="relative">
                    <BsChat className="h-5 w-5 md:h-6 md:w-6" />
                    {unseenMessages > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 md:w-5 md:h-5 text-xs flex items-center justify-center">
                        {unseenMessages}
                      </span>
                    )}
                  </div>
                  <span className="text-base md:text-lg">Messages</span>
                </Link>

                <Link
                  to="/saved"
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                    location.pathname === "/saved"
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <BsBookmark className="h-5 w-5 md:h-6 md:w-6" />
                  <span className="text-base md:text-lg">Saved</span>
                </Link>

                <Link
                  to="/notifications"
                  className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                    location.pathname === "/notifications"
                      ? "text-white bg-gray-800"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <div className="relative">
                    <BsBell className="h-5 w-5 md:h-6 md:w-6" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 md:w-5 md:h-5 text-xs flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-base md:text-lg">Notifications</span>
                </Link>

                <div className="flex items-center space-x-3 p-2 rounded-lg">
                  <img
                    src={
                      user?.profilePicture ||
                      `https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg`
                    }
                    alt="Profile"
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
                  />
                  <button
                    onClick={handleProfileClick}
                    className={`font-medium transition-colors ${
                      location.pathname === `/profile/${userId}`
                        ? "text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {user?.username || "Profile"}
                  </button>
                </div>
              </div>
            </nav>
          ) : (
            <div className="flex items-center space-x-3 p-2">
              <img
                src={`https://img.myloview.com/stickers/default-avatar-profile-icon-vector-social-media-user-photo-700-205577532.jpg`}
                alt="Profile"
                className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
              />
            </div>
          )}

          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="mt-auto p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 flex items-center space-x-3 transition-colors"
            >
              <BsPower className="h-5 w-5 md:h-6 md:w-6" />
              <span className="text-base md:text-lg">Logout</span>
            </button>
          )}
        </div>
      </aside>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}
    </>
  );
};

export default Sidebar;
