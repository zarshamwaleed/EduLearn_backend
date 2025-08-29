const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreateCourse', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  studentEmail: { type: String, required: true },
  submittedOn: { type: Date },
  marks: { type: Number },
  file: { type: String },
});

const assignmentSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreateCourse', required: true },
  title: { type: String, required: true },
  description: { type: String },
  totalMarks: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  submissionsCount: { type: Number, default: 0 },
  file: { type: String }, // NEW: Store assignment file path
});

module.exports = {
  AssignmentSubmission: mongoose.model('AssignmentSubmission', assignmentSubmissionSchema, 'submissions'),
  Assignment: mongoose.model('Assignment', assignmentSchema, 'assignments'),
};