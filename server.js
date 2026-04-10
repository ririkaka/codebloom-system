require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

// ✅ 1. Cấu hình CORS và JSON Middleware
app.use(cors());
app.use(express.json());

// 🔐 CONFIG
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || "codebloom_secret";
const MONGODB_URI = process.env.MONGODB_URI;

// ❗ CHECK ENV
if (!MONGODB_URI) {
  console.error("❌ Thiếu MONGODB_URI trong file .env");
  process.exit(1);
}

// 🔥 2. CONNECT MONGODB (Thêm cấu hình retry để tránh lỗi Render sleep)
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ Kết nối MongoDB thành công!"))
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
  });

/* ======================
    📦 SCHEMAS & MODELS
====================== */
// Lưu ý: Mongoose mặc định sẽ tìm collection số nhiều (ví dụ: 'results', 'teachers')
// Nếu database của bạn đặt tên khác, hãy thêm tham số thứ 3 vào model.

const Result = mongoose.model("Result", new mongoose.Schema({
  student_id: String,
  question_id: String,
  session_id: String,
  correct: Boolean
}));

const Student = mongoose.model("Student", new mongoose.Schema({
  student_id: String,
  name: String
}));

const Question = mongoose.model("Question", new mongoose.Schema({
  question_id: String,
  content: String,
  level: String
}));

const Teacher = mongoose.model("Teacher", new mongoose.Schema({
  teacher_id: String,
  t_name: String,
  t_password: String
}));

/* ======================
    🔐 AUTH MIDDLEWARE
====================== */
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(403).json({ success: false, message: "Không có token" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
    }
    req.user = decoded;
    next();
  });
}

/* ======================
    🔑 LOGIN TEACHER
====================== */
app.post("/teacher/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập đủ tài khoản và mật khẩu" });
    }

    const teacher = await Teacher.findOne({ t_name: username });
    if (!teacher) {
      return res.status(401).json({ success: false, message: "Tài khoản không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, teacher.t_password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Mật khẩu không chính xác" });
    }

    const token = jwt.sign(
      { teacher_id: teacher.teacher_id },
      SECRET_KEY,
      { expiresIn: "12h" }
    );

    res.json({ success: true, token });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi đăng nhập" });
  }
});

/* ======================
    📊 APIs
====================== */

app.get("/results", verifyToken, async (req, res) => {
  try {
    const data = await Result.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lấy dữ liệu kết quả" });
  }
});

app.get("/students", verifyToken, async (req, res) => {
  try {
    const data = await Student.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách học sinh" });
  }
});

app.get("/questions", async (req, res) => {
  try {
    const data = await Question.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách câu hỏi" });
  }
});

/* ======================
    🧪 TEST & START
====================== */

// Sửa lại route "/" trả về JSON để tránh lỗi "Invalid JSON" nếu frontend gọi trúng
app.get("/", (req, res) => {
  res.json({ status: "online", message: "🚀 CodeBloom API is running smoothly!" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});