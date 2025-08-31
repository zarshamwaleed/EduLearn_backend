const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const validator = require("validator");
const multer = require("multer");
const path = require("path");
const cloudinary = require("../utils/cloudinary");
const { authenticateToken } = require("../middleware/authMiddleware");




// Store files in memory instead of disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

module.exports = upload;

router.post("/signup", upload.single("profilePic"), async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, role, bio } = req.body;
    const cloudinary = require("../utils/cloudinary");

    let profilePicUrl = "";

    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "profile_pics" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        profilePicUrl = uploadResult.secure_url; // ✅ ab safe hai
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return res.status(500).json({ message: "Error uploading profile picture" });
      }
    }

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Please fill all the required fields" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already taken" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      profilePic: profilePicUrl,
      bio,
      enrolledCourses: [],
    });

    await newUser.save();

    return res.status(201).json({ message: "Registration successful!" });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Server error", details: error.message });
  }
});


router.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Please fill all the required fields" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined");
      return res.status(500).json({ message: "JWT secret not set in environment" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("Generated JWT token:", token);
    console.log("Token payload:", { id: user._id.toString(), role: user.role, name: user.name, email: user.email });

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic,
      bio: user.bio,
      role: user.role,
      enrolledCourses: user.enrolledCourses, // Include enrolled courses
    };

    return res.status(200).json({
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Signin error:", error);
    return res.status(500).json({ message: "Server error", details: error.message });
  }
});

router.get("/user/:id", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error", details: error.message });
  }
});

router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password'); // Exclude password
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error", details: error.message });
  }
});

router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { name, email, bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, bio },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic,
      bio: user.bio,
      role: user.role,
      enrolledCourses: user.enrolledCourses,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error", details: error.message });
  }
});

router.put(
  "/profile/picture",
  authenticateToken,
  upload.single("profilePic"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const uploadFromBuffer = (buffer) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "profile_pics" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(buffer);
        });

      const result = await uploadFromBuffer(req.file.buffer);

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { profilePic: result.secure_url },
        { new: true }
      ).select("-password");

      res.json(user);
    } catch (error) {
      console.error("Error updating profile picture:", error);
      res.status(500).json({ message: "Server error", details: error.message });
    }
  }
);


router.put(
  "/profile/update",
  authenticateToken,
  upload.single("profilePic"),
  async (req, res) => {
    try {
      const { name, email, bio } = req.body;

      let profilePicUrl = null;
      if (req.file) {
        // Upload file from buffer
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "profile_pics" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        profilePicUrl = result.secure_url;
      }

      const updateData = { name, email, bio };
      if (profilePicUrl) updateData.profilePic = profilePicUrl;

      const user = await User.findByIdAndUpdate(req.user._id, updateData, {
        new: true,
      }).select("-password");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        bio: user.bio,
        role: user.role,
        enrolledCourses: user.enrolledCourses,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Server error", details: error.message });
    }
  }
);
module.exports = router;