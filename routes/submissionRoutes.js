const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Quiz = require('../models/QuizUpload');
const authMiddleware = require('../middleware/authMiddleware');
const { check, validationResult } = require('express-validator');

// GET /api/submissions/:quizId - Get user's submission for a quiz
router.get('/:quizId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const submission = await Submission.findOne({
      quizId: req.params.quizId,
      userId: req.user._id,
    });
    if (!submission) {
      return res.status(404).json({ message: 'No submission found for this quiz' });
    }
    res.json(submission);
  } catch (err) {
    console.error('GET /:quizId error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/submissions/:quizId - Submit quiz answers
router.post(
  '/:quizId',
  authMiddleware.authenticateToken,
  [
    check('answers', 'Answers are required').isArray({ min: 1 }),
    check('score', 'Score is required').isInt({ min: 0 }),
    check('totalQuestions', 'Total questions is required').isInt({ min: 1 }),
    check('submitted_on', 'Submission date is required').isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation Errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { quizId } = req.params;
      const { courseId, userId, answers, score, totalQuestions, submitted_on } = req.body;

      // Verify quiz exists
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }

      // Check if user has already submitted
      const existingSubmission = await Submission.findOne({ quizId, userId });
      if (existingSubmission) {
        return res.status(400).json({ message: 'Quiz already submitted' });
      }

      // Validate courseId
      if (quiz.courseId.toString() !== courseId) {
        return res.status(400).json({ message: 'Invalid course ID' });
      }

      // Validate userId
      if (req.user._id !== userId) {
        return res.status(403).json({ message: 'Unauthorized user' });
      }

      // Create submission
      const submission = new Submission({
        quizId,
        courseId,
        userId,
        answers,
        score,
        totalQuestions,
        submitted_on,
      });

      await submission.save();
      res.status(201).json(submission);
    } catch (err) {
      console.error('POST /:quizId error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// DELETE /api/submissions/:quizId - Delete user's submission to allow retake
router.delete('/:quizId', authMiddleware.authenticateToken, async (req, res) => {
  try {
    const submission = await Submission.findOneAndDelete({
      quizId: req.params.quizId,
      userId: req.user._id,
    });
    if (!submission) {
      return res.status(404).json({ message: 'No submission found to delete' });
    }
    res.json({ message: 'Submission deleted successfully' });
  } catch (err) {
    console.error('DELETE /:quizId error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;