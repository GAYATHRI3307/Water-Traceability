const express = require('express');
const router = express.Router();
const User = require('/User');

// Register user
router.post('/signup', async (req, res) => {
  const { email, password, role, contactNumber, fieldId } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.json({ success: false, message: 'User already exists' });

    const newUser = new User({ email, password, role, contactNumber, fieldId });
    await newUser.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Signup failed' });
  }
});
