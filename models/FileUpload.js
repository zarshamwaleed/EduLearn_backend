const mongoose = require("mongoose");

const fileUploadSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CreateCourse",
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileUrl: {
    type: String,
    required: true,
  },
  contentType: {
    type: String,
    enum: [
      "file",
      "pdf",
      "image",
      "video",
      "audio",
      "presentation",
      "spreadsheet",
      "document",
      "ebook",
    ],
    default: "file",
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const FileUpload = mongoose.model("FileUpload", fileUploadSchema, "fileUploads");
module.exports = FileUpload;