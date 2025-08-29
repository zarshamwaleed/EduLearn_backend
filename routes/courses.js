const express = require('express');
const router = express.Router();
const Course = require('../models/CreateCourse');
const User = require('../models/userModel');
const { authenticateToken } = require('../middleware/authMiddleware');

// GET all courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find();
    const coursesWithInstructor = await Promise.all(
      courses.map(async (course) => {
        const instructor = await User.findOne({ email: course.instructor_email }, 'name');
        return {
          ...course._doc,
          instructor_name: instructor ? instructor.name : 'Not specified',
        };
      })
    );
    res.json(coursesWithInstructor);
  } catch (err) {
    console.error('Error fetching courses:', err);
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

// Enroll in a course
router.post('/enroll/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can enroll in courses' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (user.enrolledCourses.includes(courseId)) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    user.enrolledCourses.push(courseId);
    await user.save();

    res.status(200).json({ message: 'Successfully enrolled in course' });
  } catch (err) {
    console.error('Error enrolling in course:', err);
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

// GET enrolled courses for the authenticated student
router.get('/enrolled', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can view enrolled courses' });
    }

    const enrolledCourses = await Course.find({
      _id: { $in: user.enrolledCourses },
    });

    const coursesWithDetails = await Promise.all(
      enrolledCourses.map(async (course) => {
        const instructor = await User.findOne({ email: course.instructor_email }, 'name');
        return {
          ...course._doc,
          instructor_name: instructor ? instructor.name : 'Not specified',
          progress: 0, // Placeholder: Implement progress tracking if needed
          status: 'in_progress', // Placeholder: Implement status tracking if needed
        };
      })
    );

    res.json(coursesWithDetails);
  } catch (err) {
    console.error('Error fetching enrolled courses:', err);
    res.status(500).json({ message: 'Server error', details: err.message });
  }
});

module.exports = router;