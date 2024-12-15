import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import bg from "../assets/bg.jpg";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post("/api/auth/login", {
        email: formData.email,
        password: formData.password,
      });
      console.log(response.data.user.id);

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userId", response.data.user.id);
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 select-none pointer-events-none">
        <span className="absolute top-1/4 left-1/4 text-3xl text-blue-400 transform -rotate-12">no cap fr fr</span>
        <span className="absolute top-1/3 right-1/4 text-2xl text-green-400 transform rotate-45">slay</span>
        <span className="absolute bottom-1/4 left-1/3 text-4xl text-purple-400 transform rotate-12">bestie</span>
        <span className="absolute top-1/2 right-1/3 text-3xl text-pink-400 transform -rotate-6">periodt</span>
        <span className="absolute bottom-1/3 left-1/2 text-2xl text-yellow-400 transform rotate-90">based</span>
        <span className="absolute top-1/4 right-1/2 text-4xl text-red-400 transform -rotate-45">sheesh</span>
        <span className="absolute bottom-1/2 left-1/4 text-3xl text-orange-400 transform rotate-180">bussin</span>
        <span className="absolute top-2/3 right-1/3 text-2xl text-indigo-400 transform rotate-12">yeet</span>
        <span className="absolute bottom-1/4 right-1/4 text-4xl text-teal-400 transform -rotate-90">vibing</span>
        <span className="absolute top-1/3 left-1/3 text-3xl text-rose-400 transform rotate-45">lowkey</span>
      </div>
      <div className="max-w-md w-full space-y-8 p-10 bg-gray-900 rounded-xl shadow-2xl border border-gray-800 relative z-10">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400">Please sign in to your account</p>
        </div>

        {error && (
          <div className="bg-red-900 bg-opacity-20 border border-red-700 text-red-400 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-gray-300 block mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition duration-200"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-gray-300 block mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition duration-200"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition duration-200"
            >
              Sign In
            </button>
          </div>

          <div className="flex items-center justify-center">
            <div className="text-sm">
              <Link to="/register" className="font-medium text-blue-400 hover:text-blue-300 transition duration-200">
                Don't have an account? Sign up here
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
