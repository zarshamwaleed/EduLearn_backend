const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    try {
      if (!decoded.id) {
        return res.status(403).json({ message: 'Invalid token payload: missing id' });
      }

      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      req.user = {
        _id: user._id.toString(),
        role: user.role,
        name: user.name,
        email: user.email,
        enrolledCourses: user.enrolledCourses || [],
      };
      next();
    } catch (error) {
      console.error('Error in authentication:', error);
      res.status(500).json({ message: 'Server error', details: error.message });
    }
  });
};

const authorizeInstructor = (req, res, next) => {
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ message: 'Instructor access only' });
  }
  next();
};

module.exports = {
  authenticateToken,
  authorizeInstructor,
};