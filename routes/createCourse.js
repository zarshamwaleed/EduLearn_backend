const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const CreateCourse = require("../models/CreateCourse");
const {
  authenticateToken,
  authorizeInstructor,
} = require("../middleware/authMiddleware");

// Multer storage setup
const storage = multer.memoryStorage(); // keep file in memory
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

module.exports = upload;

// Create course - only instructor can access
router.post(
  "/",
  authenticateToken,
  authorizeInstructor,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, price, duration_weeks, description, status } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      console.log("Creating course with user:", req.user); // Debug log

      const image_url = req.file
        ? `${req.protocol}://${req.get("host")}/Uploads/${req.file.filename}`
        : "";

      const newCourse = new CreateCourse({
        title,
        price,
        duration_weeks,
        description,
        image_url,
        status: status || "draft",
        instructor_name: req.user.name,
        instructor_email: req.user.email,
        instructorId: req.user._id.toString(), // Convert to string for consistency
        created_at: new Date(),
        updated_at: new Date(),
      });

      await newCourse.save();
      res.status(201).json({
        message: "Course created successfully",
        course: newCourse,
      });
    } catch (error) {
      console.error("Error creating course:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

// Get all courses
router.get("/", async (req, res) => {
  try {
    const courses = await CreateCourse.find();
    res.json(courses);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Get single course by ID
router.get("/:id", async (req, res) => {
  try {
    const course = await CreateCourse.findById(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ error: `Course with ID ${req.params.id} not found` });
    }
    res.json(course);
  } catch (err) {
    console.error("Error fetching course:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Update course by ID - only instructor can access
router.put(
  "/:id",
  authenticateToken,
  authorizeInstructor,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, price, duration_weeks, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      const course = await CreateCourse.findById(req.params.id);
      if (!course) {
        return res
          .status(404)
          .json({ error: `Course with ID ${req.params.id} not found` });
      }

      // Log for debugging
      console.log("Logged-in user ID:", req.user._id);
      console.log("Course instructorId:", course.instructorId);

      // Convert both IDs to strings for comparison
      if (String(course.instructorId) !== String(req.user._id)) {
        return res
          .status(403)
          .json({ error: "Unauthorized to update this course" });
      }

      const image_url = req.file
        ? `${req.protocol}://${req.get("host")}/Uploads/${req.file.filename}`
        : course.image_url;

      const updatedCourse = await CreateCourse.findByIdAndUpdate(
        req.params.id,
        {
          title,
          price,
          duration_weeks,
          description,
          image_url,
          updated_at: new Date(),
        },
        { new: true }
      );

      res.json({
        message: "Course updated successfully",
        course: updatedCourse,
      });
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

// Delete course by ID - only instructor can access
router.delete(
  "/:id",
  authenticateToken,
  authorizeInstructor,
  async (req, res) => {
    try {
      const course = await CreateCourse.findById(req.params.id);
      if (!course) {
        return res
          .status(404)
          .json({ error: `Course with ID ${req.params.id} not found` });
      }

      // Check if the logged-in user is the instructor of the course
      if (String(course.instructorId) !== String(req.user._id)) {
        return res
          .status(403)
          .json({ error: "Unauthorized to delete this course" });
      }

      // Delete the course
      await CreateCourse.findByIdAndDelete(req.params.id);

      res.json({ message: "Course deleted successfully" });
    } catch (error) {
      console.error("Error deleting course:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

module.exports = router;