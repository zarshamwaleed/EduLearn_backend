const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./db"); // 👈 new connection util

const authRoutes = require("./routes/authRoutes");
const createCourseRoutes = require("./routes/createCourse");
const courseRoutes = require("./routes/courses");
const uploadFileRoutes = require("./routes/uploadFile");
const quizRoutes = require("./routes/quizRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const assignmentRoutes = require("./routes/assignments");
const courseProgressRoutes = require("./routes/courseProgress");
const fileProgressRoutes = require("./routes/FileProgressRoutes");
const analyticsRoutes = require("./routes/analytics");

const app = express();

// Middleware
app.use(express.json());

// CORS config
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:3000",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || true); // 👈 actual origin return hoga
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


// DB Connection (connect once per cold start)
connectDB();

// Routes
app.get("/", (req, res) => res.send("API is running 🚀"));
app.use("/api/auth", authRoutes);
app.use("/api/create-course", createCourseRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/upload", uploadFileRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api", assignmentRoutes);
app.use("/api/course-progress", courseProgressRoutes);
app.use("/api/file-progress", fileProgressRoutes);
app.use("/api/analytics", analyticsRoutes);

// ⚠️ Do not use app.listen on Vercel
module.exports = app;
