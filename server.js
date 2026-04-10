const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// =======================
// 🛠 1. Middleware (Sửa lỗi CORS và JSON)
// =======================
app.use(cors());
app.use(express.json());
// Quan trọng: Phục vụ file tĩnh đúng cách từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// 🔗 2. Kết nối MongoDB Atlas
// =======================
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Kết nối MongoDB Atlas thành công!"))
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
  });

// =======================
// 📦 3. Schemas & Models
// =======================
const resultSchema = new mongoose.Schema({
  studentId: String,
  question_id: String,
  session_id: String,
  correct: Boolean,
  createdAt: { type: Date, default: Date.now }
});
const Result = mongoose.model('Result', resultSchema);

const studentSchema = new mongoose.Schema({
  student_id: { type: String, unique: true },
  name: String
});
const Student = mongoose.model('Student', studentSchema);

// =======================
// 📌 4. API Routes (Sửa lỗi 404/JSON)
// =======================

// Đăng nhập giáo viên
app.post('/teacher/login', (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "123456") {
    res.json({ success: true, token: "secret-token-2026", message: "Thành công" });
  } else {
    res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
  }
});

// Lấy toàn bộ kết quả (Dành cho Admin)
app.get('/api/results', async (req, res) => {
  try {
    const results = await Result.find().sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Lấy danh sách học sinh
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Lưu bài làm học sinh
app.post('/api/submit', async (req, res) => {
  try {
    const newResult = new Result(req.body);
    await newResult.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// 🌐 5. Phục vụ Giao diện (Khắc phục lỗi "Unexpected token <")
// =======================

// Các trang cụ thể
app.get('/role-select', (req, res) => res.sendFile(path.join(__dirname, 'public/role-select.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/teacher-login', (req, res) => res.sendFile(path.join(__dirname, 'public/teacher-login.html')));

// Route mặc định cho mọi đường dẫn khác - TRÁNH TRẢ VỀ HTML KHI GỌI API
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/teacher/')) return next();
  res.sendFile(path.join(__dirname, 'public/role-select.html'));
});

// =======================
// 🚀 6. Start Server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));