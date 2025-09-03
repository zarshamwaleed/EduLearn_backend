const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const cloudinary = require("../utils/cloudinary");
const FileUpload = require("../models/FileUpload");
const CreateCourse = require("../models/CreateCourse");
const User = require("../models/userModel");
const { authenticateToken, authorizeInstructor } = require("../middleware/authMiddleware");

// Configure Multer storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|mp4|mp3|ppt|pptx|xls|xlsx|doc|docx|txt/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype.toLowerCase());

    if (extname && mimetype) cb(null, true);
    else cb(new Error("Invalid file type"), false);
  },
});


// ❌ remove: module.exports = upload;

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

      let fileUrl = "";
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "course_files", resource_type: "auto" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        fileUrl = result.secure_url;
      }

      const newFile = new FileUpload({
        courseId,
        fileName: req.file.originalname,
        fileUrl, // from Cloudinary
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
          fileUrl, // ✅ already secure Cloudinary URL
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
        file_url: content.fileUrl, // ✅ already secure Cloudinary URL
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

      await FileUpload.deleteOne({ _id: contentId });

      res.json({ message: "Content deleted successfully" });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ error: "Server error while deleting content", details: error.message });
    }
  }
);
router.get("/:courseId/download/:fileId", authenticateToken, async (req, res) => {
  try {
    const file = await FileUpload.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Optional: Verify user has access to this course before allowing download

    // Generate signed URL valid for 5 minutes
    const signedUrl = cloudinary.utils.private_download_url(
      file.fileUrl.split("/").pop().split(".")[0], // Extract public_id from URL
      file.fileName.split(".").pop(), // extension (e.g. pdf)
      {
        type: "authenticated", // for private resources
        expires_at: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
      }
    );

    res.redirect(signedUrl);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: "Server error while downloading" });
  }
});

router.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File size too large. Max 50MB allowed." });
  }
  if (err.message && err.message.includes("Invalid file type")) {
    return res.status(400).json({ error: "File type not allowed." });
  }
  console.error("Upload middleware error:", err);
  return res.status(500).json({ error: "Unexpected error during upload." });
});

module.exports = router;
