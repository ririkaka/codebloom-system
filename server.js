require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(cors());

// 🔐 CONFIG
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || "codebloom_secret";
const MONGODB_URI = process.env.MONGODB_URI;

// ❗ CHECK ENV
if (!MONGODB_URI) {
  console.error("❌ Thiếu MONGODB_URI trong .env");
  process.exit(1);
}

// 🔥 CONNECT MONGODB
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

/* ======================
   📦 SCHEMA
====================== */

const ResultSchema = new mongoose.Schema({
  student_id: String,
  question_id: String,
  session_id: String,
  correct: Boolean
});

const StudentSchema = new mongoose.Schema({
  student_id: String,
  name: String
});

const QuestionSchema = new mongoose.Schema({
  question_id: String,
  content: String,
  level: String
});

// 🔥 THEO DB CỦA BẠN
const TeacherSchema = new mongoose.Schema({
  teacher_id: String,
  t_name: String,
  t_password: String
});

/* ======================
   📦 MODEL
====================== */

const Result = mongoose.model("Result", ResultSchema);
const Student = mongoose.model("Student", StudentSchema);
const Question = mongoose.model("Question", QuestionSchema);
const Teacher = mongoose.model("Teacher", TeacherSchema);

/* ======================
   🔐 AUTH MIDDLEWARE
====================== */

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(403).json({ message: "Không có token" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Token không hợp lệ" });
    }
    req.user = decoded;
    next();
  });
}

/* ======================
   🔑 LOGIN TEACHER (bcrypt)
====================== */

app.post("/teacher/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // 🔍 tìm theo t_name
    const teacher = await Teacher.findOne({ t_name: username });

    if (!teacher) {
      return res.status(401).json({ message: "Sai tài khoản" });
    }

    // 🔐 so sánh password đã mã hóa
    const isMatch = await bcrypt.compare(password, teacher.t_password);

    if (!isMatch) {
      return res.status(401).json({ message: "Sai mật khẩu" });
    }

    // 🔥 tạo token
    const token = jwt.sign(
     { teacher_id: teacher.teacher_id },
      SECRET_KEY,
   //   { expiresIn: "12h" }
    );

    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ======================
   📊 API
====================== */

// RESULTS
app.get("/results", verifyToken, async (req, res) => {
  try {
    const data = await Result.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// STUDENTS
app.get("/students", verifyToken, async (req, res) => {
  try {
    const data = await Student.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

// QUESTIONS (public)
app.get("/questions", async (req, res) => {
  try {
    const data = await Question.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ======================
   🧪 TEST
====================== */

app.get("/", (req, res) => {
  res.send("🚀 CodeBloom API running...");
});

/* ======================
   🚀 START
====================== */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});