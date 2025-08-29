const mongoose = require("mongoose");

// Define schema
const createCourseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    duration_weeks: {
      type: Number,
      default: 1,
      min: 1,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    image_url: {
      type: String,
      default: "",
    },

    // ✅ Files uploaded (PDF, Docs, Videos, etc.)
    files: [
      {
        fileName: { type: String },
        fileUrl: { type: String }, // e.g., "/uploads/lecture1.pdf"
        contentType: { type: String }, // pdf, image/png, mp4
        uploadedBy: { type: String }, // instructor name or ID
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // ✅ Instructor info
    instructor_name: {
      type: String,
      required: true,
    },
    instructor_email: {
      type: String,
      required: true,
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // link to users collection
      required: true,
    },

    // ✅ Timestamps
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
    collection: "createCourses",
  }
);

// Auto-update `updated_at` on save
createCourseSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Create model
const CreateCourse = mongoose.model("CreateCourse", createCourseSchema);

module.exports = CreateCourse;
