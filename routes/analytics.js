// backend/routes/analytics.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { authenticateToken, authorizeInstructor } = require("../middleware/authMiddleware");
const User = require("../models/userModel");
const CreateCourse = require("../models/CreateCourse");
const CourseProgress = require("../models/CourseProgress");

// Get instructor analytics
router.get(
  "/instructor",
  authenticateToken,
  authorizeInstructor,
  async (req, res) => {
    try {
      const instructorId = req.user._id;
      console.log("Instructor ID:", instructorId);

      // Fetch instructor's courses
      const courses = await CreateCourse.find({ instructorId }).select("_id title price");
      console.log("Courses found:", courses.map(c => ({ id: c._id.toString(), title: c.title })));

      if (courses.length === 0) {
        console.log("No courses found for instructor");
        return res.status(200).json({
          stats: {
            totalStudents: 0,
            averageRating: 0,
            totalRevenue: 0,
            courseCount: 0,
          },
        });
      }

      const courseIds = courses.map((course) => course._id);
      const courseIdsAsStrings = courseIds.map(id => id.toString());
      console.log("Course IDs as strings:", courseIdsAsStrings);

      // 1. Total Students - Fixed aggregation
      // Since enrolledCourses in User model stores course IDs as strings,
      // we need to match against the string versions
      const uniqueStudentsResult = await User.aggregate([
        {
          $match: {
            role: "student",
            enrolledCourses: { $in: courseIdsAsStrings }, // Use string IDs
          },
        },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            studentIds: { $push: "$_id" } // For debugging
          },
        },
      ]);
      
      console.log("Unique students aggregation result:", uniqueStudentsResult);
      const totalStudents = uniqueStudentsResult.length > 0 ? uniqueStudentsResult[0].totalStudents : 0;

      // Alternative method using simple find (for verification)
      const studentsDirectCount = await User.countDocuments({
        role: "student",
        enrolledCourses: { $in: courseIdsAsStrings },
      });
      console.log("Direct count verification:", studentsDirectCount);

      // Use the direct count as it's more reliable
      const finalStudentCount = studentsDirectCount;

      // 2. Average Rating - using ObjectId for CourseProgress
      const ratingStats = await CourseProgress.aggregate([
        {
          $match: {
            courseId: { $in: courseIds }, // Use ObjectIds for CourseProgress
            userRating: { $exists: true, $ne: null, $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$userRating" },
            count: { $sum: 1 },
          },
        },
      ]);
      console.log("Rating stats aggregation:", ratingStats);
      const averageRating = ratingStats.length > 0 ? parseFloat(ratingStats[0].averageRating.toFixed(1)) : 0;

      // 3. Total Revenue - Calculate based on enrollments
      const enrollmentStats = await User.aggregate([
        {
          $match: {
            role: "student",
            enrolledCourses: { $in: courseIdsAsStrings },
          },
        },
        {
          $unwind: "$enrolledCourses",
        },
        {
          $match: {
            enrolledCourses: { $in: courseIdsAsStrings },
          },
        },
        {
          $group: {
            _id: "$enrolledCourses",
            enrollmentCount: { $sum: 1 },
          },
        },
      ]);
      console.log("Enrollment stats aggregation:", enrollmentStats);

      let totalRevenue = 0;
      for (const stat of enrollmentStats) {
        const course = courses.find((c) => c._id.toString() === stat._id);
        if (course) {
          totalRevenue += course.price * stat.enrollmentCount;
          console.log(`Course: ${course.title}, Price: ${course.price}, Enrollments: ${stat.enrollmentCount}, Revenue: ${course.price * stat.enrollmentCount}`);
        }
      }
      console.log("Total revenue calculated:", totalRevenue);

      // 4. Total Courses
      const courseCount = courses.length;

      // Additional debugging - Show enrolled students
      const enrolledStudents = await User.find({
        role: "student",
        enrolledCourses: { $in: courseIdsAsStrings },
      }).select("name email enrolledCourses");
      console.log("Enrolled students details:", enrolledStudents.map(s => ({
        name: s.name,
        email: s.email,
        enrolledCourses: s.enrolledCourses,
      })));

      // Return analytics data
      const analyticsData = {
        stats: {
          totalStudents: finalStudentCount,
          averageRating,
          totalRevenue,
          courseCount,
        },
        debug: {
          courseIds: courseIdsAsStrings,
          enrolledStudentsCount: enrolledStudents.length,
          enrolledStudentsEmails: enrolledStudents.map(s => s.email),
        }
      };

      console.log("Final analytics data:", analyticsData);
      res.status(200).json(analyticsData);
    } catch (error) {
      console.error("Error fetching instructor analytics:", error);
      res.status(500).json({ message: "Server error while fetching analytics", details: error.message });
    }
  }
);

module.exports = router;