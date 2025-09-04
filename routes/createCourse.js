const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const CreateCourse = require("../models/CreateCourse");
const cloudinary = require("../utils/cloudinary"); // Make sure this path is correct
const {
  authenticateToken,
  authorizeInstructor,
} = require("../middleware/authMiddleware");

// Multer setup for memory storage (since we're uploading to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype.toLowerCase());

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Function to upload buffer to Cloudinary
const uploadToCloudinary = (fileBuffer, originalname) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "course-images",
        public_id: `course-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        transformation: [
          { width: 800, height: 450, crop: "fill", quality: "auto:good" }
        ]
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

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

      console.log("Creating course with user:", req.user);
      console.log("File received:", req.file ? "Yes" : "No");

      let image_url = "";
      
      // Upload image to Cloudinary if file exists
      if (req.file) {
        try {
          console.log("Uploading to Cloudinary...");
          image_url = await uploadToCloudinary(req.file.buffer, req.file.originalname);
          console.log("Cloudinary upload successful:", image_url);
        } catch (uploadError) {
          console.error("Error uploading to Cloudinary:", uploadError);
          return res.status(500).json({ 
            error: "Failed to upload image", 
            details: uploadError.message 
          });
        }
      }

      const newCourse = new CreateCourse({
        title,
        price: price ? parseFloat(price) : 0,
        duration_weeks: duration_weeks ? parseInt(duration_weeks) : 1,
        description,
        image_url, // This will be the Cloudinary URL or empty string
        status: status || "draft",
        instructor_name: req.user.name,
        instructor_email: req.user.email,
        instructorId: req.user._id.toString(),
        created_at: new Date(),
        updated_at: new Date(),
      });

      await newCourse.save();
      
      console.log("Course created successfully with image_url:", image_url);
      
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

      // Check authorization
      if (String(course.instructorId) !== String(req.user._id)) {
        return res
          .status(403)
          .json({ error: "Unauthorized to update this course" });
      }

      let image_url = course.image_url; // Keep existing image by default
      
      // Upload new image to Cloudinary if provided
      if (req.file) {
        try {
          console.log("Uploading new image to Cloudinary...");
          image_url = await uploadToCloudinary(req.file.buffer, req.file.originalname);
          console.log("New image uploaded successfully:", image_url);
          
          // Optionally delete old image from Cloudinary
          if (course.image_url && course.image_url.includes('cloudinary.com')) {
            try {
              const publicId = course.image_url.split('/').pop().split('.')[0];
              await cloudinary.uploader.destroy(`course-images/${publicId}`);
              console.log("Old image deleted from Cloudinary");
            } catch (deleteError) {
              console.log("Could not delete old image:", deleteError.message);
            }
          }
        } catch (uploadError) {
          console.error("Error uploading new image:", uploadError);
          return res.status(500).json({ 
            error: "Failed to upload new image", 
            details: uploadError.message 
          });
        }
      }

      const updatedCourse = await CreateCourse.findByIdAndUpdate(
        req.params.id,
        {
          title,
          price: price ? parseFloat(price) : course.price,
          duration_weeks: duration_weeks ? parseInt(duration_weeks) : course.duration_weeks,
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

      if (String(course.instructorId) !== String(req.user._id)) {
        return res
          .status(403)
          .json({ error: "Unauthorized to delete this course" });
      }

      // Delete image from Cloudinary if it exists
      if (course.image_url && course.image_url.includes('cloudinary.com')) {
        try {
          const publicId = course.image_url.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`course-images/${publicId}`);
          console.log("Image deleted from Cloudinary");
        } catch (deleteError) {
          console.log("Could not delete image from Cloudinary:", deleteError.message);
        }
      }

      await CreateCourse.findByIdAndDelete(req.params.id);

      res.json({ message: "Course deleted successfully" });
    } catch (error) {
      console.error("Error deleting course:", error);
      res.status(500).json({ error: "Server error", details: error.message });
    }
  }
);

module.exports = router;