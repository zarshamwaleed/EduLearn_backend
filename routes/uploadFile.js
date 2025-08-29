const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const FileUpload = require("../models/FileUpload");
const CreateCourse = require("../models/CreateCourse");
const User = require("../models/userModel");
const { authenticateToken, authorizeInstructor } = require("../middleware/authMiddleware");

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "Uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = {
      file: [/.*/],
      pdf: ["application/pdf"],
      image: ["image/jpeg", "image/png", "image/gif"],
      video: ["video/mp4", "video/avi"],
      audio: ["audio/mpeg", "audio/wav"],
      presentation: [
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ],
      spreadsheet: [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
      document: [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      ebook: ["application/epub+zip", "application/x-mobipocket-ebook"],
    };

    const contentType = req.body.contentType || "file";
    const allowedMimes = allowedTypes[contentType] || [/.*/];

    if (allowedMimes.some((regex) => regex.test(file.mimetype))) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type for ${contentType}.`));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// @route   POST /api/upload/:courseId
// @desc    Upload file for a course
// @access  Private (Instructor only)
router.post(
  "/:courseId",
  authenticateToken,
  authorizeInstructor,
  upload.single("file"),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { contentType } = req.body;
      const uploadedBy = req.user._id;

      const course = await CreateCourse.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      if (course.instructorId.toString() !== uploadedBy) {
        return res.status(403).json({ error: "Unauthorized: You are not the instructor of this course" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = `/Uploads/${req.file.filename}`.replace(/\\/g, "/");

      const newFile = new FileUpload({
        courseId,
        fileName: req.file.originalname,
        fileUrl,
        contentType: contentType || "file",
        uploadedBy,
      });

      await newFile.save();

      res.status(201).json({
        message: "File uploaded successfully",
        file: {
          _id: newFile._id,
          courseId,
          fileName: newFile.fileName,
          fileUrl: `${req.protocol}://${req.get("host")}${fileUrl}`,
          contentType: newFile.contentType,
          uploadedBy,
          uploadedAt: newFile.uploadedAt,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ error: `Validation error: ${error.message}` });
      }
      if (error.message.includes("Invalid file type")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Server error while uploading file", details: error.message });
    }
  }
);

// @route   GET /api/upload/:courseId
// @desc    Get all content for a course
// @access  Private (Instructor or enrolled student)
router.get("/:courseId", authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const course = await CreateCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (
      user.role === "student" &&
      !user.enrolledCourses.includes(courseId)
    ) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    const contents = await FileUpload.find({ courseId });
    res.json(
      contents.map((content) => ({
        content_id: content._id,
        content_type: content.contentType,
        file_name: content.fileName,
        file_url: `${req.protocol}://${req.get("host")}${content.fileUrl}`,
        uploaded_at: content.uploadedAt,
      }))
    );
  } catch (error) {
    console.error("Error fetching course content:", error);
    res.status(500).json({ error: "Server error while fetching content", details: error.message });
  }
});

// @route   DELETE /api/upload/:courseId/:contentId
// @desc    Delete a content item for a course
// @access  Private (Instructor only)
router.delete(
  "/:courseId/:contentId",
  authenticateToken,
  authorizeInstructor,
  async (req, res) => {
    try {
      const { courseId, contentId } = req.params;
      const uploadedBy = req.user._id;

      const course = await CreateCourse.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      if (course.instructorId.toString() !== uploadedBy) {
        return res.status(403).json({ error: "Unauthorized: You are not the instructor of this course" });
      }

      const content = await FileUpload.findOne({ _id: contentId, courseId });
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      // Delete file from filesystem
      const filePath = path.join(__dirname, "..", content.fileUrl.replace(/^\//, ""));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await FileUpload.deleteOne({ _id: contentId });

      res.json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ error: "Server error while deleting content", details: error.message });
    }
  }
);

module.exports = router;