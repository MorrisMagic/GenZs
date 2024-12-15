import { Routes, Route, useLocation } from "react-router-dom";
import Register from "./screens/Register";
import Login from "./screens/Login";
import axios from "axios";
import Home from "./screens/Home";
import SinglePost from "./screens/SinglePost";
import Profile from "./screens/Profile";
import Chat from "./screens/chat";
import Saved from "./screens/Saved";
import Search from "./screens/Search";
import Sidebar from "./components/Sidebar";
import LeftBar from "./components/LeftBar";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import Hashtag from "./screens/Hashtag";
import { useEffect, useState } from "react";
import Notification from "./screens/Notification";
axios.defaults.baseURL = "http://localhost:5000";
axios.defaults.withCredentials = true;


function App() {
  const location = useLocation();
  const [hideLeftBar, setHideLeftBar] = useState(false);
  const [hideSidebar, setHideSidebar] = useState(false);

  useEffect(() => {
    const pathsToHideLeftBar = ["/login", "/register", "/chat"];
    const pathsToHideSidebar = ["/login", "/register"];
    
    if (pathsToHideLeftBar.includes(location.pathname)) {
      setHideLeftBar(true);
    } else {
      setHideLeftBar(false);
    }

    if (pathsToHideSidebar.includes(location.pathname)) {
      setHideSidebar(true);
    } else {
      setHideSidebar(false);
    }
  }, [location.pathname]);

  return (
    <div className="App">
      {!hideSidebar && <Sidebar />}
      {!hideLeftBar && <LeftBar />}
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/posts/:postId" element={<SinglePost />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/search" element={<Search />} />
        <Route path="/hashtag/:hashtag" element={<Hashtag />} />
        <Route path="/notifications" element={<Notification />} />
      </Routes>
    </div>
  );
}

export default App;
