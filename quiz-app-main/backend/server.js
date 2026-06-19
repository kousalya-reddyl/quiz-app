require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const auth = require("./middleware/auth");
const admin = require("./middleware/admin");

const User = require("./models/User");
const Question = require("./models/Question");
const Score = require("./models/Score");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const JWT_SECRET = process.env.JWT_SECRET;

// ================= AUTH =================

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    if (password.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: "User exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashed
    });

    await user.save();
    res.json({ message: "Registered successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      role: user.role,
      username: user.username
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

// ================= QUESTIONS =================

// Get Questions (Any logged user)
app.get("/api/questions", auth, async (req, res) => {
  const questions = await Question.aggregate([
    { $sample: { size: 5 } }
  ]);
  res.json(questions);
});

// Add Question (Admin only)
app.post("/api/questions", auth, admin, async (req, res) => {
  const question = new Question(req.body);
  await question.save();
  res.json(question);
});

// ================= SCORES =================

// Save Score
app.post("/api/scores", auth, async (req, res) => {
  const score = new Score({
    user: req.user.id,
    score: req.body.score
  });

  await score.save();
  res.json(score);
});

// Leaderboard
app.get("/api/scores", auth, async (req, res) => {
  const scores = await Score.find()
    .populate("user", "username")
    .sort({ score: -1 })
    .limit(10);

  res.json(scores);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
