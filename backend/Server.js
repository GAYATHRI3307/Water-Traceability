const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/users', require('./LoginUserRoutes')); // ✅ mount the 
// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

// ✅ Define Mongoose User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'farmer'],
    required: true,
  },
  contactNumber: String,
  fieldId: String,
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User',default: null } 
});

// ✅ Pre-save hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ✅ Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ✅ Signup Route
// Correct farmer signup route
// Signup route
app.post('/api/users/signup', async (req, res) => {
  const { email, password, role, contactNumber, fieldId } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.json({ success: false, message: 'User already exists' });

    const newUser = new User({
      email,
      password,
      role,
      contactNumber,
      fieldId
    });

    // ✅ Assign adminId for farmers
    if (role === 'farmer') {
      const admin = await User.findOne({ role: 'admin', fieldId });
      if (!admin) {
        return res.status(400).json({ success: false, message: 'No admin with this field ID' });
      }
      newUser.adminId = admin._id;
    }

    // ✅ Assign adminId for admins (self-reference)
    if (role === 'admin') {
      newUser.adminId = newUser._id; // ← Yes, this is okay to assign here
    }

    await newUser.save(); // ✅ Save once, after setting adminId

    res.json({ success: true });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false });
  }
});
// ✅ Login Route
// Login route (backend)
app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });

    // Return adminId only if role is admin, else return user's own adminId
    const adminIdToSend = user.role === 'admin' ? user._id : user.adminId;

    res.json({
      success: true,
      role: user.role,
      fieldId: user.fieldId,
      adminId: adminIdToSend
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});



// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const waterFlowSchema = new mongoose.Schema({
  fieldId: String,
  flowRate: Number,
  status: String,
  timestamp: { type: Date, default: Date.now }
});
const WaterFlow = mongoose.models.WaterFlow || mongoose.model('WaterFlow', waterFlowSchema);

app.get('/api/water/status/:fieldId', async (req, res) => {
  try {
    const latest = await WaterFlow.findOne({ fieldId: req.params.fieldId })
      .sort({ timestamp: -1 });
    res.json(latest);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch water status' });
  }
});
// In server.js or routes file
// ✅ server.js or LoginUserRoutes.js
app.get('/api/users/farmers', async (req, res) => {
  const { adminId } = req.query;

  try {
    const farmers = await User.find({
      role: 'farmer',
      adminId:adminId
    }).select('-password');

    res.json(farmers);
  } catch (err) {
    console.error('Error fetching farmers:', err);
    res.status(500).json({ message: 'Error fetching farmers' });
  }
});


const canalFlowSchema = new mongoose.Schema({
  canalId: String,
  flowRate: Number,
  adminId: String,
  timestamp: { type: Date, default: Date.now }
});

const CanalFlow = mongoose.models.CanalFlow || mongoose.model('CanalFlow', canalFlowSchema);
app.get('/api/canals/:canalId/flow', async (req, res) => {
  const { canalId } = req.params;
  const { adminId } = req.query;

  try {
    const flowData = await CanalFlow.find({ canalId, adminId }).sort({ timestamp: 1 });
    res.json(flowData);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch flow data' });
  }
});
const flowRuleSchema = new mongoose.Schema({
  canalId: { type: String, required: true },
  minFlowRate: Number,
  maxFlowRate: Number,
  adminId: String,
});
const FlowRule = mongoose.models.FlowRule || mongoose.model('FlowRule', flowRuleSchema);
// Get all rules
app.get('/api/rules', async (req, res) => {
  const { adminId } = req.query;
  try {
    const rules = await FlowRule.find({ adminId });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch rules' });
  }
});

// Add or update a rule
app.post('/api/rules', async (req, res) => {
  const { canalId, minFlowRate, maxFlowRate, adminId } = req.body;

  try {
    const rule = new FlowRule({ canalId, minFlowRate, maxFlowRate, adminId });
    await rule.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error saving rule' });
  }
});
app.delete('/api/rules/:id', async (req, res) => {
  try {
    await FlowRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});
const notificationSchema = new mongoose.Schema({
  canalId: String,
  message: String,
  adminId: String,
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
app.post('/api/canals/flow', async (req, res) => {
  const { canalId, flowRate, adminId } = req.body;
  console.log(`Flow received: ${canalId}, ${flowRate}, admin: ${adminId}`);

  try {
    await CanalFlow.create({ canalId, flowRate, adminId });
    console.log('✅ Flow saved');

    const rule = await FlowRule.findOne({ canalId, adminId }); // ✅ Scoped by admin
    if (!rule) {
      console.log('❌ No rule found for this canal + admin');
      return res.json({ success: true });
    }

    console.log(`🔍 Rule found: ${rule.minFlowRate} - ${rule.maxFlowRate}`);

    if (flowRate < rule.minFlowRate || flowRate > rule.maxFlowRate) {
      const message = `🚨 ${canalId} flow ${flowRate} L/min violated rule (${rule.minFlowRate}–${rule.maxFlowRate})`;

      await Notification.create({
        canalId,
        message,
        adminId,
        timestamp: new Date(),
        read: false
      });

      console.log('🔔 Notification created:', message);
    } else {
      console.log('✅ Flow within rule limits');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Flow error:', err);
    res.status(500).json({ success: false });
  }
});

app.get('/api/notifications', async (req, res) => {
  const { adminId } = req.query;

  try {
    const filtered = await Notification.find({ adminId }).sort({ timestamp: -1 });
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load notifications' });
  }
});

app.get('/api/canals/all', async (req, res) => {
  const { adminId } = req.query;

  try {
    const flows = await CanalFlow.find({ adminId });
    const uniqueCanals = [...new Set(flows.map(f => f.canalId))];
    res.json(uniqueCanals);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch canal list' });
  }
});
