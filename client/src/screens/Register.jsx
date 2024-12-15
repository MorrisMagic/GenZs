import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import bg from "../assets/bg.mp4";

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
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

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match fr fr");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password needs to be at least 8 characters");
      return;
    }

    try {
      const response = await axios.post("/api/auth/register", {
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      if (response.status === 201) {
        navigate("/login");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-myblack  flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            Welcome to GenZ
          </h1>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border rounded-lg text-red-200 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-gray-200 text-sm font-medium block mb-2">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 placeholder-gray-400"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="text-gray-200 text-sm font-medium block mb-2">Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 placeholder-gray-400"
                placeholder="Choose a username"
                required
              />
            </div>

            <div>
              <label className="text-gray-200 text-sm font-medium block mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 placeholder-gray-400"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="text-gray-200 text-sm font-medium block mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 placeholder-gray-400"
                placeholder="Create a password"
                required
              />
            </div>

            <div>
              <label className="text-gray-200 text-sm font-medium block mb-2">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-100 placeholder-gray-400"
                placeholder="Confirm your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-[1.02]"
          >
            Sign Up
          </button>

          <p className="text-center text-gray-400 text-sm">
            Already have an account?{" "}
            <a href="/login" className="text-purple-400 hover:text-purple-300">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
