// backend/seed.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/userModel");
const CreateCourse = require("./models/CreateCourse");
const CourseProgress = require("./models/CourseProgress");

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/lms");

const seedData = async () => {
  try {
    // Verify instructor exists
    const instructor = await User.findById("68a2ffa8e7dc693a9c403355");
    if (!instructor) {
      throw new Error("Instructor not found");
    }
    // console.log("Instructor found:", instructor.email);

    // Course IDs as ObjectIds
    const courseIds = [
      new mongoose.Types.ObjectId("68aeeca0571984e2e02ff390"),
      new mongoose.Types.ObjectId("68af4bd2635e328694f6b2c1"),
      new mongoose.Types.ObjectId("68afff39695cead24b2cbe16"),
    ];

    // Convert to strings for User.enrolledCourses (since your User model expects strings)
    const courseIdsAsStrings = courseIds.map(id => id.toString());

    // Verify courses exist
    const courses = await CreateCourse.find({ _id: { $in: courseIds } });
    if (courses.length !== 3) {
      throw new Error("Not all courses found");
    }
    // console.log("Courses verified:", courses.map(c => c.title));

    // Delete existing CourseProgress
    await CourseProgress.deleteMany({ courseId: { $in: courseIds } });
    // console.log("Cleared existing CourseProgress");

    // Create or update students
    let student1 = await User.findOne({ email: "student1@example.com" });
    let student2 = await User.findOne({ email: "student2@example.com" });

    const hashedPassword = await bcrypt.hash("password123", 10);

    if (!student1) {
      student1 = await User.create({
        name: "Student 1",
        email: "student1@example.com",
        password: hashedPassword,
        role: "student",
        enrolledCourses: courseIdsAsStrings, // Use strings
      });
      // console.log("Created Student 1");
    } else {
      await User.updateOne(
        { _id: student1._id },
        { $set: { enrolledCourses: courseIdsAsStrings } } // Use strings
      );
      // console.log("Updated Student 1");
    }

    if (!student2) {
      student2 = await User.create({
        name: "Student 2",
        email: "student2@example.com",
        password: hashedPassword,
        role: "student",
        enrolledCourses: courseIdsAsStrings, // Use strings
      });
      // console.log("Created Student 2");
    } else {
      await User.updateOne(
        { _id: student2._id },
        { $set: { enrolledCourses: courseIdsAsStrings } } // Use strings
      );
      // console.log("Updated Student 2");
    }

    // Create CourseProgress entries (these use ObjectIds as expected)
    await CourseProgress.create([
      {
        userId: student1._id,
        courseId: courseIds[0], // ObjectId
        userRating: 4,
        feedback: "Great course on dffd!",
        updatedAt: new Date(),
      },
      {
        userId: student2._id,
        courseId: courseIds[0], // ObjectId
        userRating: 3,
        feedback: "Really enjoyed the dffd course!",
        updatedAt: new Date(),
      },
      {
        userId: student1._id,
        courseId: courseIds[1], // ObjectId
        userRating: 3,
        feedback: "Good intro to 3gw!",
        updatedAt: new Date(),
      },
      {
        userId: student2._id,
        courseId: courseIds[2], // ObjectId
        userRating: 2,
        feedback: "Decent fwrgwrgd course!",
        updatedAt: new Date(),
      },
    ]);
    // console.log("Created 4 CourseProgress entries");

    // console.log("Database seeded successfully");
    mongoose.disconnect();
  } catch (error) {
    // console.error("Error seeding database:", error);
    mongoose.disconnect();
  }
};

seedData();