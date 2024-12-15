import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication and get user data
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/user', {
          withCredentials: true
        });
        setUser(response.data);
      } catch (err) {
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    // Connect to socket
    const socket = io('http://localhost:5000');

    // Listen for new notifications
    socket.on(`notification-${user._id}`, (data) => {
      setNotifications(prev => [data.notification, ...prev]);
    });

    // Fetch existing notifications
    const fetchNotifications = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/notifications`, {
          withCredentials: true
        });
        setNotifications(response.data);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    fetchNotifications();

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleNotificationClick = async (notification) => {
    try {
      // Mark notification as read
      await axios.put(
        `http://localhost:5000/api/notifications/${notification._id}`,
        { read: true },
        { withCredentials: true }
      );

      // Update notifications state
      setNotifications(prev =>
        prev.map(n =>
          n._id === notification._id ? { ...n, read: true } : n
        )
      );

      // Navigate based on notification type
      if (notification.post) {
        navigate(`/posts/${notification.post._id}`);
      } else if (notification.type === 'follow') {
        navigate(`/profile/${notification.from._id}`);
      }
    } catch (err) {
      console.error('Error handling notification:', err);
    }
  };
  return (
    <div className="ml-[300px] mr-[360px] bg-myblack min-h-screen text-white">
      <div className="sticky top-0 z-10 bg-myblack border-b border-gray-700 px-4 py-3">
        <h1 className="text-xl font-semibold">Notifications</h1>
      </div>

      <div className="divide-y divide-gray-800">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="font-medium">No notifications yet</p>
            <p className="text-sm">When you have notifications, they'll show up here</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              onClick={() => handleNotificationClick(notification)}
              className={`flex items-center p-4 hover:bg-gray-800 cursor-pointer transition-colors ${
                !notification.read ? 'bg-gray-900' : ''
              }`}
            >
              <div className="flex-shrink-0">
                <img
                  src={notification.from.profilePicture || '/default-avatar.png'}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
              </div>
              <div className="ml-4 flex-grow">
                <div className="flex items-center">
                  <p className="text-sm">
                    <span className="font-semibold">{notification.from.username}</span>
                    <span className="ml-1">
                      {notification.type === 'like' && 'liked your post'}
                      {notification.type === 'comment' && 'commented on your post'}
                      {notification.type === 'follow' && 'started following you'}
                      {notification.type === 'repost' && 'reposted your post'}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(notification.createdAt).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {notification.post?.image && (
                <div className="ml-4 flex-shrink-0">
                  <img
                    src={notification.post.image}
                    alt=""
                    className="w-14 h-14 object-cover"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notification;
