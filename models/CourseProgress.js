const mongoose = require('mongoose');

const courseProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreateCourse',
    required: true,
  },
  progress: {
    type: Number,
    default: 0,
  },
  userRating: {
    type: Number,
    default: 0,
  },
  feedback: {
    type: String,
    default: '',
  },
  completedContents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileUpload',
  }],
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add any indexes or methods if needed
courseProgressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema);

module.exports = CourseProgress;