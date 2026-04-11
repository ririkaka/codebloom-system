const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs'); // Đảm bảo đã chạy: npm install bcryptjs

const app = express();

// --- 1. Cấu hình Middleware ---
app.use(cors());
app.use(express.json());
// Phục vụ các file trong folder public (admin.html, teacher-login.html, admin.js...)
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. Kết nối MongoDB Atlas ---
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";
mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Connected: CodeBloom Database"))
    .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// --- 3. Định nghĩa Models (Khớp với dữ liệu thực tế của bạn) ---
// Model Giáo viên (Dùng để kiểm tra mật khẩu đã hash $2b$12$...)
const Teacher = mongoose.model('Teacher', new mongoose.Schema({
    t_name: String,
    t_password: String
}, { collection: 'teachers' }));

// Model Học sinh
const Student = mongoose.model('Student', new mongoose.Schema({
    student_id: String,
    name: String
}, { collection: 'students' }));

// Model Kết quả bài làm
const Result = mongoose.model('Result', new mongoose.Schema({
    studentId: String,
    question_id: String,
    correct: Boolean,
    session_id: String
}, { collection: 'results', timestamps: true }));

// --- 4. API Đăng nhập giáo viên (Xử lý Bcrypt) ---
app.post('/api/teacher/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const teacher = await Teacher.findOne({ t_name: username });
        if (!teacher) {
            return res.status(401).json({ success: false, message: "Tài khoản không tồn tại!" });
        }

        // So sánh mật khẩu nhập vào với mật khẩu hash trong DB
        const isMatch = await bcrypt.compare(password, teacher.t_password);
        if (isMatch) {
            res.json({ success: true, token: "valid" });
        } else {
            res.status(401).json({ success: false, message: "Mật khẩu không chính xác!" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống server!" });
    }
});

// --- 5. API Lấy dữ liệu cho Dashboard Admin ---

// Lấy danh sách học sinh
app.get('/api/students', async (req, res) => {
    try {
        const data = await Student.find();
        res.json(data);
    } catch (err) { res.status(500).json([]); }
});

// Lấy toàn bộ kết quả nộp bài
app.get('/api/results', async (req, res) => {
    try {
        const data = await Result.find().sort({ createdAt: -1 });
        res.json(data);
    } catch (err) { res.status(500).json([]); }
});

// --- 6. Điều hướng Frontend ---
// Luôn trả về trang login nếu người dùng vào địa chỉ không tồn tại
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/teacher-login.html'));
});

// --- 7. Khởi chạy Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`----------------------------------------`);
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📂 Folder giao diện: /public`);
    console.log(`----------------------------------------`);
});