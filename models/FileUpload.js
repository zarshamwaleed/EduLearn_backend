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
  publicId: {             // ✅ NEW FIELD (Cloudinary public_id)
    type: String,
    required: true,
  },
  format: {               // ✅ NEW FIELD (Cloudinary format)
    type: String,
  },
  resourceType: {         // ✅ NEW FIELD (Cloudinary resource_type)
    type: String,
    default: "raw",       // "raw" is safe for docs/pdf/ppt etc.
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
