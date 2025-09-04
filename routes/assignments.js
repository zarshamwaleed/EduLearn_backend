const express = require('express');
const router = express.Router();
const { Assignment, AssignmentSubmission } = require('../models/assignmentSchemas');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const { authenticateToken, authorizeInstructor } = require('../middleware/authMiddleware');
const CreateCourse = require('../models/CreateCourse');
const fs = require('fs');
const cloudinary = require("../utils/cloudinary");

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|pdf|mp4|mp3|ppt|pptx|xls|xlsx|doc|docx|txt/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype.toLowerCase());

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"), false);
    }
  },
});

module.exports = upload;

// Get all assignments for a course (for instructors or general)
router.get('/courses/:courseId/assignments', authenticateToken, async (req, res) => {
  try {
    const course = await CreateCourse.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (req.user.role === 'student' && !req.user.enrolledCourses.includes(req.params.courseId)) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    const assignments = await Assignment.find({ courseId: req.params.courseId });
    const formattedAssignments = assignments.map(assignment => ({
      _id: assignment._id,
      courseId: assignment.courseId,
      title: assignment.title,
      description: assignment.description || '', // Make sure this is properly set
      totalMarks: assignment.totalMarks,
      dueDate: assignment.dueDate.toISOString(),
      submissionsCount: assignment.submissionsCount,
      file: assignment.file,
    }));
    
    // Debug log to check if description is coming through
    console.log('Assignments with descriptions:', formattedAssignments.map(a => ({ 
      title: a.title, 
      description: a.description 
    })));
    
    res.json(formattedAssignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ message: 'Error fetching assignments', error: error.message });
  }
});

// Get all assignments for a course with student-specific submission info
router.get('/courses/:courseId/assignments/student', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Student access only' });
    }

    const course = await CreateCourse.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (!req.user.enrolledCourses.includes(req.params.courseId)) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    const assignments = await Assignment.find({ courseId: req.params.courseId });

    const studentAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const submission = await AssignmentSubmission.findOne({
          assignmentId: assignment._id,
          studentId: req.user._id,
        });

        return {
          assignment_id: assignment._id,
          title: assignment.title,
          description: assignment.description || '', // Ensure description is included
          due_date: assignment.dueDate.toISOString(),
          submitted: !!submission,
          submitted_on: submission ? submission.submittedOn.toISOString() : null,
          marks: submission ? submission.marks : null,
          total_marks: assignment.totalMarks,
          submission_id: submission ? submission._id : null,
          file: assignment.file,
        };
      })
    );

    res.json(studentAssignments);
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    res.status(500).json({ message: 'Error fetching student assignments', error: error.message });
  }
});

// Get a single assignment by ID
// Updated backend route with debug logging
router.get('/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Debug logs
    console.log('Raw assignment from DB:', assignment);
    console.log('Assignment description from DB:', assignment.description);
    console.log('Description type:', typeof assignment.description);
    console.log('Description length:', assignment.description?.length);
    
    const responseData = {
      _id: assignment._id,
      courseId: assignment.courseId,
      title: assignment.title,
      description: assignment.description || '', // Ensure description is included
      totalMarks: assignment.totalMarks,
      dueDate: assignment.dueDate.toISOString(),
      submissionsCount: assignment.submissionsCount,
      file: assignment.file,
    };
    
    console.log('Response data being sent:', responseData);
    console.log('Response description:', responseData.description);
    
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ message: 'Error fetching assignment', error: error.message });
  }
});

// Download assignment file
router.get('/assignments/:assignmentId/download', authenticateToken, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (!assignment.file) {
      return res.status(404).json({ message: 'No assignment file available' });
    }

    const course = await CreateCourse.findById(assignment.courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (req.user.role === 'student' && !req.user.enrolledCourses.includes(assignment.courseId.toString())) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    const filePath = path.resolve(__dirname, '..', assignment.file.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.download(filePath, `${assignment.title}_assignment${path.extname(assignment.file)}`);
  } catch (error) {
    console.error('Error downloading assignment file:', error);
    res.status(500).json({ message: 'Error downloading assignment file', error: error.message });
  }
});

// Create a new assignment
router.post(
  '/courses/:courseId/assignments',
  authenticateToken,
  authorizeInstructor,
  upload.single('file'),
  async (req, res) => {
    try {
      const { title, description, totalMarks, dueDate } = req.body;

      if (!title || !totalMarks || !dueDate) {
        return res.status(400).json({ message: 'Title, total marks, and due date are required' });
      }

      const course = await CreateCourse.findById(req.params.courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      if (course.instructorId.toString() !== req.user._id) {
        return res.status(403).json({ message: 'Unauthorized: You are not the instructor of this course' });
      }

      let fileUrl = null;
      let publicId = null;

      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              folder: "assignments",
              resource_type: "auto", // 👈 detects whether it's image/video/raw
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file.buffer);
        });

        fileUrl = result.secure_url;
        publicId = result.public_id;
      }

      const newAssignment = new Assignment({
        courseId: req.params.courseId,
        title,
        description: description || '',
        totalMarks: parseInt(totalMarks),
        dueDate: new Date(dueDate),
        submissionsCount: 0,
        file: fileUrl,
        cloudinaryId: publicId, // store public_id for private download
      });

      await newAssignment.save();
      res.status(201).json({
        message: 'Assignment created successfully',
        assignment: newAssignment,
      });
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ message: 'Error creating assignment', error: error.message });
    }
  }
);

// Update an assignment
router.put('/assignments/:assignmentId', authenticateToken, authorizeInstructor, upload.single('file'), async (req, res) => {
  try {
    const { title, description, totalMarks, dueDate } = req.body;
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const course = await CreateCourse.findById(assignment.courseId);
    if (!course || course.instructorId.toString() !== req.user._id) {
      return res.status(403).json({ message: 'Unauthorized: You are not the instructor of this course' });
    }

    if (title) assignment.title = title;
    if (description !== undefined) assignment.description = description; // Handle empty description
    if (totalMarks) assignment.totalMarks = parseInt(totalMarks);
    if (dueDate) assignment.dueDate = new Date(dueDate);
    if (req.file) assignment.file = `/Uploads/${req.file.filename}`;

    await assignment.save();
    res.json({ message: 'Assignment updated successfully', assignment });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ message: 'Error updating assignment', error: error.message });
  }
});

// Delete an assignment
router.delete('/assignments/:assignmentId', authenticateToken, authorizeInstructor, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const course = await CreateCourse.findById(assignment.courseId);
    if (!course || course.instructorId.toString() !== req.user._id) {
      return res.status(403).json({ message: 'Unauthorized: You are not the instructor of this course' });
    }

    await AssignmentSubmission.deleteMany({ assignmentId: req.params.assignmentId });
    await assignment.deleteOne();
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ message: 'Error deleting assignment', error: error.message });
  }
});

// Get submissions for an assignment
router.get('/assignments/:assignmentId/submissions', authenticateToken, authorizeInstructor, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    const course = await CreateCourse.findById(assignment.courseId);
    if (!course || course.instructorId.toString() !== req.user._id) {
      return res.status(403).json({ message: 'Unauthorized: You are not the instructor of this course' });
    }

    const submissions = await AssignmentSubmission.find({ assignmentId: req.params.assignmentId }).populate(
      'studentId',
      'name email'
    );
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
});

// Submit an assignment
router.post(
  '/assignments/:assignmentId/submissions',
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    try {
      const { studentId, studentName, studentEmail, courseId } = req.body;

      // ✅ Validate required fields
      if (!studentId || !studentName || !studentEmail || !courseId) {
        return res.status(400).json({
          message: 'Student ID, name, email, and course ID are required',
        });
      }

      // ✅ Validate assignment exists
      const assignment = await Assignment.findById(req.params.assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

  // ✅ Declare variables at the top
let fileUrl = null;
let publicId = null;
let resourceType = "raw";
let result = null; // <-- FIX: declare result globally

if (req.file) {
  try {
    result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "submissions", resource_type: "auto" },
          (error, uploadResult) => {
            if (error) reject(error);
            else resolve(uploadResult);
          }
        )
        .end(req.file.buffer);
    });

    fileUrl = result.secure_url;
    publicId = result.public_id;
    resourceType = result.resource_type || "raw";
  } catch (uploadError) {
    console.error("Cloudinary upload failed:", uploadError);
    return res.status(500).json({
      message: "Failed to upload file to Cloudinary",
      error: uploadError.message,
    });
  }
}

// ✅ Only check result if it exists
if (result && result.resource_type) {
  resourceType = result.resource_type;
}

      // ✅ Create new submission document
      const submission = new AssignmentSubmission({
        assignmentId: req.params.assignmentId,
        courseId,
        studentId,
        studentName,
        studentEmail,
        submittedOn: new Date(),
        file: fileUrl,
        cloudinaryId: publicId, // ✅ store for delete/download
          resourceType,
      });

      await submission.save();

      // ✅ Increment submissionsCount
      await Assignment.findByIdAndUpdate(req.params.assignmentId, {
        $inc: { submissionsCount: 1 },
      });

      res.status(201).json({
        message: 'Submission created successfully',
        submission,
      });
    } catch (error) {
      console.error('Error submitting assignment:', error);
      res.status(500).json({
        message: 'Error submitting assignment',
        error: error.message,
      });
    }
  }
);


// Grade a submission
router.put('/assignment-submissions/:submissionId/grade', authenticateToken, authorizeInstructor, async (req, res) => {
  try {
    const { marks } = req.body;
    const submission = await AssignmentSubmission.findById(req.params.submissionId).populate('assignmentId');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (marks > submission.assignmentId.totalMarks) {
      return res.status(400).json({ message: `Marks cannot exceed ${submission.assignmentId.totalMarks}` });
    }

    submission.marks = parseInt(marks);
    await submission.save();
    res.json({ message: 'Submission graded successfully', submission });
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ message: 'Error grading submission', error: error.message });
  }
});

router.get("/assignment-submissions/:submissionId/download", async (req, res) => {
  try {
    console.log("📥 Download request received:", req.params.submissionId);

    const submission = await AssignmentSubmission.findById(req.params.submissionId);
    if (!submission) {
      console.log("❌ No submission found for this ID");
      return res.status(404).json({ message: "Submission not found" });
    }

    if (!submission.cloudinaryId) {
      console.log("⚠️ No Cloudinary public_id stored in DB for this file");
      return res.status(400).json({ message: "File missing Cloudinary ID" });
    }

    // ✅ Extract format safely
    let fileFormat = undefined;
    if (submission.file) {
      const cleanUrl = submission.file.split("?")[0]; // remove query params
      fileFormat = cleanUrl.split(".").pop(); // extract extension cleanly
    }

    // ✅ Use "upload" type instead of "authenticated"
    const signedUrl = cloudinary.utils.private_download_url(
      submission.cloudinaryId,
      fileFormat,
      {
        resource_type: submission.resourceType || "raw",
        type: "upload",  // ✅ FIX: use upload type
        expires_at: Math.floor(Date.now() / 1000) + 300, // 5 min expiry
      }
    );

    console.log(`✅ Signed URL generated: ${signedUrl}`);
    return res.json({ signedUrl });
  } catch (error) {
    console.error("🚨 Error generating signed download URL:", error);
    res.status(500).json({ message: "Error downloading file", error: error.message });
  }
});





module.exports = router;