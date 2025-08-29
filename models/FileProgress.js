const mongoose = require("mongoose");

const fileProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FileUpload",
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CreateCourse",
    required: true,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
});

const FileProgress = mongoose.model("FileProgress", fileProgressSchema);
module.exports = FileProgress;
