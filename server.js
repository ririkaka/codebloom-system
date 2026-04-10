const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// 🛠 1. Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔗 2. Kết nối MongoDB Atlas
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Kết nối MongoDB thành công!"))
  .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err.message));

// 📦 3. Định nghĩa Schemas & Models
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

// 🔐 4. Danh sách Giáo viên (Dựa trên file teachers.json của bạn)
const teachers = [
  { "teacher_id": "t1", "t_name": "ddd", "t_password": "123" },
  { "teacher_id": "t2", "t_name": "eee", "t_password": "456" },
  { "teacher_id": "t3", "t_name": "fff", "t_password": "789" }
];

// 📌 5. API Routes

// API Đăng nhập giáo viên (Xử lý theo dữ liệu t_name và t_password)
app.post('/teacher/login', (req, res) => {
  const { username, password } = req.body;
  
  // Tìm giáo viên khớp tên đăng nhập và mật khẩu
  const teacher = teachers.find(t => t.t_name === username && String(t.t_password) === String(password));

  if (teacher) {
    res.json({ 
      success: true, 
      token: "secret-token-" + teacher.teacher_id, 
      message: "Đăng nhập thành công" 
    });
  } else {
    res.status(401).json({ success: false, message: "Sai tên đăng nhập hoặc mật khẩu" });
  }
});

// API Lấy kết quả cho bảng Admin
app.get('/api/results', async (req, res) => {
  try {
    const results = await Result.find().sort({ createdAt: -1 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// API Lấy danh sách học sinh
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

// 🌐 6. Xử lý Route giao diện (Tránh lỗi 404/JSON)
app.get('*', (req, res, next) => {
  // Nếu là gọi API thì bỏ qua để Express xử lý lỗi JSON riêng
  if (req.url.startsWith('/api/') || req.url.startsWith('/teacher/')) return next();
  res.sendFile(path.join(__dirname, 'public/role-select.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server đang chạy trên cổng ${PORT}`));