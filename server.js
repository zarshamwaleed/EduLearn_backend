require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

// Ensure Uploads directory exists
const uploadDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Uploads directory created');
}

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'];
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
  allowedHeaders: ['Content-Type', 'Authorization'], // Explicitly allow Authorization header
}));

// Serve uploaded files statically
app.use('/Uploads', express.static(uploadDir));

// Middleware for parsing JSON
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/lms', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected to LMS database'))
  .catch(err => {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
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
// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});