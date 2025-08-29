const express = require("express");
const router = express.Router();
const Quiz = require("../models/QuizUpload");
const CreateCourse = require("../models/CreateCourse");
const { authenticateToken, authorizeInstructor } = require("../middleware/authMiddleware");

// @route   POST /api/quizzes/:courseId
// @desc    Create a new quiz for a course
// @access  Private (Instructor only)
router.post("/:courseId", authenticateToken, authorizeInstructor, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, duration, questions } = req.body;
    const instructorId = req.user._id;

    // Validate course exists and user is the instructor
    const course = await CreateCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (course.instructorId.toString() !== instructorId) {
      return res.status(403).json({ message: "Unauthorized: You are not the instructor of this course" });
    }

    // Validate questions
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "At least one question is required" });
    }
    for (const [index, question] of questions.entries()) {
      if (!question.qContent?.trim()) {
        return res.status(400).json({ message: `Question ${index + 1}: Content is required` });
      }
      if (!question.options || question.options.length === 0) {
        return res.status(400).json({ message: `Question ${index + 1}: At least one option is required` });
      }
      if (!question.options.some((opt) => opt.correct)) {
        return res.status(400).json({ message: `Question ${index + 1}: At least one correct option is required` });
      }
      for (const [optIndex, option] of question.options.entries()) {
        if (!option.text?.trim()) {
          return res.status(400).json({ message: `Question ${index + 1}, Option ${optIndex + 1}: Text is required` });
        }
      }
    }

    const quiz = new Quiz({
      courseId,
      title,
      duration,
      instructorId,
      questions,
    });

    await quiz.save();
    res.status(201).json({ message: "Quiz created successfully", quiz });
  } catch (error) {
    console.error("Error creating quiz:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: `Validation error: ${error.message}` });
    }
    res.status(500).json({ message: "Server error while creating quiz", details: error.message });
  }
});

// @route   GET /api/quizzes/:courseId
// @desc    Get all quizzes for a course
// @access  Private (Instructor or enrolled student)
router.get("/:courseId", authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await CreateCourse.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if user is instructor or enrolled student
    if (
      req.user.role === "student" &&
      !req.user.enrolledCourses.includes(courseId)
    ) {
      return res.status(403).json({ message: "Not enrolled in this course" });
    }

    const quizzes = await Quiz.find({ courseId });
    res.json(quizzes);
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    res.status(500).json({ message: "Server error while fetching quizzes", details: error.message });
  }
});

// @route   GET /api/quizzes/single/:quizId
// @desc    Get single quiz by ID
// @access  Private (Instructor or enrolled student)
router.get("/single/:quizId", authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check if user is instructor or enrolled student
    const course = await CreateCourse.findById(quiz.courseId);
    if (
      req.user.role === "student" &&
      !req.user.enrolledCourses.includes(quiz.courseId.toString())
    ) {
      return res.status(403).json({ message: "Not enrolled in this course" });
    }

    res.json(quiz);
  } catch (error) {
    console.error("Error fetching quiz:", error);
    res.status(500).json({ message: "Server error while fetching quiz", details: error.message });
  }
});

// @route   PUT /api/quizzes/:quizId
// @desc    Update a quiz
// @access  Private (Instructor only)
router.put("/:quizId", authenticateToken, authorizeInstructor, async (req, res) => {
  try {
    const { title, duration, questions } = req.body;
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Validate instructor
    if (quiz.instructorId.toString() !== req.user._id) {
      return res.status(403).json({ message: "Unauthorized: You are not the instructor of this quiz" });
    }

    // Validate questions
    if (questions) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "At least one question is required" });
      }
      for (const [index, question] of questions.entries()) {
        if (!question.qContent?.trim()) {
          return res.status(400).json({ message: `Question ${index + 1}: Content is required` });
        }
        if (!question.options || question.options.length === 0) {
          return res.status(400).json({ message: `Question ${index + 1}: At least one option is required` });
        }
        if (!question.options.some((opt) => opt.correct)) {
          return res.status(400).json({ message: `Question ${index + 1}: At least one correct option is required` });
        }
        for (const [optIndex, option] of question.options.entries()) {
          if (!option.text?.trim()) {
            return res.status(400).json({ message: `Question ${index + 1}, Option ${optIndex + 1}: Text is required` });
          }
        }
      }
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.quizId,
      { title, duration, questions, updated_at: Date.now() },
      { new: true }
    );
    res.json({ message: "Quiz updated successfully", quiz: updatedQuiz });
  } catch (error) {
    console.error("Error updating quiz:", error);
    res.status(500).json({ message: "Server error while updating quiz", details: error.message });
  }
});

// @route   DELETE /api/quizzes/:quizId
// @desc    Delete a quiz
// @access  Private (Instructor only)
router.delete("/:quizId", authenticateToken, authorizeInstructor, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.instructorId.toString() !== req.user._id) {
      return res.status(403).json({ message: "Unauthorized: You are not the instructor of this quiz" });
    }

    await Quiz.deleteOne({ _id: req.params.quizId });
    res.json({ message: "Quiz deleted successfully" });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    res.status(500).json({ message: "Server error while deleting quiz", details: error.message });
  }
});

module.exports = router;