const express = require('express');
const router = express.Router();
const User = require('./User'); // adjust the path as needed
const bcrypt = require('bcryptjs');

// LOGIN route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });

    res.json({
      success: true,
      role: user.role,         // must be 'admin' or 'farmer'
      fieldId: user.fieldId,   // optional
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
