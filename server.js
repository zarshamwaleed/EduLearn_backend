require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const createCourseRoutes = require('./routes/createCourse');
const courseRoutes = require('./routes/courses');
const uploadFileRoutes = require('./routes/uploadFile');
const quizRoutes = require('./routes/quizRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const assignmentRoutes = require('./routes/assignments');
const courseProgressRoutes = require("./routes/courseProgress");
const fileProgressRoutes = require("./routes/FileProgressRoutes");
const analyticsRoutes = require("./routes/analytics");

const app = express();
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});
// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 20000, // 20 seconds
})

  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error(`MongoDB connection error: ${err.message}`);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/create-course', createCourseRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/upload', uploadFileRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api', assignmentRoutes);
app.use("/api/course-progress", courseProgressRoutes);
app.use("/api/file-progress", fileProgressRoutes);
app.use("/api/analytics", analyticsRoutes);

// ⚠️ Do not use app.listen on Vercel
module.exports = app;
