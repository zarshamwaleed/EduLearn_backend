const express = require("express");
const router = express.Router();
const {authenticateToken} = require("../middleware/authMiddleware");
const FileUpload = require("../models/FileUpload");
const FileProgress = require("../models/FileProgress");
const User = require("../models/userModel");

// @route POST /api/file-progress/toggle
router.post("/toggle", authenticateToken, async (req, res) => {
  try {
    const { fileId, courseId } = req.body;
    const userId = req.user._id;

    const file = await FileUpload.findById(fileId);
    if (!file) return res.status(404).json({ error: "File not found" });

    const user = await User.findById(userId);
    if (!user || !user.enrolledCourses.includes(courseId)) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    let progress = await FileProgress.findOne({ userId, fileId, courseId });
    if (!progress) {
      progress = new FileProgress({ userId, fileId, courseId, isCompleted: true, completedAt: Date.now() });
    } else {
      progress.isCompleted = !progress.isCompleted;
      progress.completedAt = progress.isCompleted ? Date.now() : null;
    }

    await progress.save();

    res.json({
  message: progress.isCompleted
    ? "File marked as completed!"
    : "File marked as incomplete!",
  isCompleted: progress.isCompleted,
  fileId,
  content_id: fileId, // 👈 add this for frontend match
});

  } catch (error) {
    console.error("Error toggling file completion:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
