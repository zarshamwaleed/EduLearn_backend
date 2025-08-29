const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  profilePic: { type: String, default: null },
  bio: { type: String, default: "" },
  role: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  enrolledCourses: [{ type: String }], // Array of course IDs (as strings)
});

const User = mongoose.model("User", userSchema, "users"); // Explicitly set collection to "users"
module.exports = User;