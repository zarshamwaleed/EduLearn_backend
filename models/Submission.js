const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'createCourses', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [
    {
      questionId: { type: Number, required: true },
      selectedOptionId: { type: String, required: true },
    },
  ],
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  submitted_on: { type: Date, required: true },
});

module.exports = mongoose.model('Submission', submissionSchema, 'submissions');