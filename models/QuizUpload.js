const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreateCourse",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: String, // e.g., "01:30:00" (HH:mm:ss)
      required: true,
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questions: [
      {
        qContent: {
          type: String,
          required: true,
          trim: true,
        },
        options: [
          {
            text: {
              type: String,
              required: true,
              trim: true,
            },
            correct: {
              type: Boolean,
              default: false,
            },
          },
        ],
      },
    ],
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "quizzes",
  }
);

// Auto-update `updated_at` on save
quizSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const Quiz = mongoose.model("Quiz", quizSchema, "quizzes");

module.exports = Quiz;