const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// =======================
// 🛠 1. Middleware
// =======================
app.use(cors());
app.use(express.json());
// Phục vụ các file tĩnh (HTML, CSS, JS) trong thư mục public
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
// 📦 3. Định nghĩa Schemas & Models
// =======================

// Lưu kết quả làm bài của học sinh
const resultSchema = new mongoose.Schema({
  studentId: { type: String, required: true }, // Mã số học sinh (ví dụ: 001)
  question_id: { type: String, required: true }, // Mã câu hỏi (ví dụ: Q001)
  session_id: { type: String, required: true }, // Phiên làm bài (ví dụ: PHIEN_1)
  correct: { type: Boolean, required: true }, // Đúng hay Sai
  createdAt: { type: Date, default: Date.now }
});
const Result = mongoose.model('Result', resultSchema);

// Lưu thông tin học sinh (để hiển thị Họ Tên trên bảng Admin)
const studentSchema = new mongoose.Schema({
  student_id: { type: String, required: true, unique: true },
  name: { type: String, required: true }
});
const Student = mongoose.model('Student', studentSchema);

// =======================
// 📌 4. API Routes
// =======================

// --- API HỌC SINH ---

// API nộp bài: Lưu kết quả cho từng câu hỏi
app.post('/api/submit', async (req, res) => {
  try {
    const { studentId, question_id, session_id, correct } = req.body;
    const newResult = new Result({ studentId, question_id, session_id, correct });
    await newResult.save();
    res.status(201).json({ success: true, message: "Đã lưu câu trả lời" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- API GIÁO VIÊN (ADMIN) ---

// API Đăng nhập giáo viên
app.post('/teacher/login', (req, res) => {
  const { username, password } = req.body;
  // Tài khoản mẫu
  if (username === "admin" && password === "123456") {
    res.json({ 
      success: true, 
      token: "secret-token-codebloom-2026", 
      message: "Đăng nhập thành công" 
    });
  } else {
    res.status(401).json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu" });
  }
});

// API Lấy toàn bộ kết quả để hiển thị trên bảng Admin
app.get('/api/results', async (req, res) => {
  try {
    const results = await Result.find().sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Không thể lấy dữ liệu kết quả" });
  }
});

// API Lấy danh sách học sinh (Để map mã SV sang Họ Tên)
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: "Không thể lấy danh sách học sinh" });
  }
});

// API thêm học sinh mới (Dùng để khởi tạo dữ liệu nếu cần)
app.post('/api/students/add', async (req, res) => {
    try {
        const { student_id, name } = req.body;
        const student = new Student({ student_id, name });
        await student.save();
        res.json({ message: "Đã thêm học sinh" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================
// 🌐 5. Phục vụ Giao diện
// =======================

// Route mặc định cho mọi đường dẫn khác sẽ trả về trang chọn vai trò
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'role-select.html'));
});

// =======================
// 🚀 6. Start Server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  -----------------------------------------
  🚀 SERVER CODEBLOOM HOÀN CHỈNH
  📡 Cổng: ${PORT}
  🔗 API Test: http://localhost:${PORT}/api/results
  -----------------------------------------
  `);
});