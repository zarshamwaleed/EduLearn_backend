const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const CourseProgress = require("../models/CourseProgress");
const FileUpload = require("../models/FileUpload"); // Import FileUpload model to count total content
const jwt = require("jsonwebtoken"); // For authentication

// Middleware to verify JWT token and extract user
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Ensure JWT_SECRET is set in .env
    req.user = decoded; // Attach decoded user info (should include userId)
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};

// Validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Get all feedback for a course
router.get("/course/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }
    const feedbacks = await CourseProgress.find({
      courseId,
      $or: [{ userRating: { $gt: 0 } }, { feedback: { $ne: "" } }],
    }).select("userRating feedback updatedAt");
    res.json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get course progress for a user
router.get("/:userId/:courseId", authMiddleware, async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    if (!isValidObjectId(userId) || !isValidObjectId(courseId)) {
      return res.status(400).json({ error: "Invalid user ID or course ID" });
    }
    if (req.user.id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    let progress = await CourseProgress.findOne({ userId, courseId });
    if (!progress) {
      progress = new CourseProgress({
        userId,
        courseId,
        progress: 0,
        userRating: 0,
        feedback: "",
        completedContents: [],
      });
      await progress.save();
    }
    res.json(progress);
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create or update course progress, rating, feedback
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { userId, courseId, progress, userRating, feedback, completedContents } = req.body;

    // Validate userId and courseId
    if (!isValidObjectId(userId) || !isValidObjectId(courseId)) {
      return res.status(400).json({ error: "Invalid user ID or course ID" });
    }

    // Ensure the requesting user can only update their own progress
    if (req.user.id !== userId) {
      return res.status(403).json({ error: "Unauthorized to update this progress" });
    }

    // Validate progress and userRating
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ error: "Progress must be between 0 and 100" });
    }
    if (userRating < 0 || userRating > 5) {
      return res.status(400).json({ error: "Rating must be between 0 and 5" });
    }

    // Validate completedContents
    if (completedContents && !Array.isArray(completedContents)) {
      return res.status(400).json({ error: "completedContents must be an array" });
    }
    if (completedContents && completedContents.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ error: "Invalid content ID in completedContents" });
    }

    const updatedProgress = await CourseProgress.findOneAndUpdate(
      { userId, courseId },
      { progress, userRating, feedback, completedContents, updatedAt: Date.now() },
      { new: true, upsert: true }
    );

    res.json(updatedProgress);
  } catch (error) {
    console.error("Error updating course progress:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle completion status for a specific content item
router.post("/toggle-content-complete", authMiddleware, async (req, res) => {
  try {
    const { userId, courseId, contentId } = req.body;

    // Validate IDs
    if (!isValidObjectId(userId) || !isValidObjectId(courseId) || !isValidObjectId(contentId)) {
      return res.status(400).json({ error: "Invalid userId, courseId, or contentId" });
    }

    // Ensure user can update only their own progress
    if (req.user.id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Check if content belongs to the course
    const content = await FileUpload.findOne({ _id: contentId, courseId });
    if (!content) {
      return res.status(404).json({ error: "Content not found or does not belong to this course" });
    }

    let progress = await CourseProgress.findOne({ userId, courseId });
    if (!progress) {
      progress = new CourseProgress({
        userId,
        courseId,
        progress: 0,
        userRating: 0,
        feedback: "",
        completedContents: [],
      });
    }

    // Toggle completion status
    const isCompleted = progress.completedContents.includes(contentId);
    if (isCompleted) {
      progress.completedContents = progress.completedContents.filter(
        (id) => id.toString() !== contentId
      );
    } else {
      progress.completedContents.push(contentId);
    }

    // Calculate progress based on completed contents
    const totalContent = await FileUpload.countDocuments({ courseId });
    progress.progress = totalContent > 0 ? (progress.completedContents.length / totalContent) * 100 : 0;
    progress.updatedAt = Date.now();

    await progress.save();

    res.json(progress);
  } catch (error) {
    console.error("Error toggling content completion:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;