const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config(); 

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 1. KẾT NỐI DATABASE
// Sử dụng chuỗi .env bạn cung cấp. Lưu ý: codebloom là tên database trên Atlas.
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";

mongoose.connect(mongoURI) // FIX LỖI: Đã xóa các options lỗi trong ảnh image_8adbc5.png
    .then(() => console.log('✅ MongoDB Connected: codebloom'))
    .catch(err => console.error('❌ MongoDB Error:', err.message));

// 2. SCHEMA & MODEL
const studentSchema = new mongoose.Schema({
    student_id: { type: String, required: true },
    name: { type: String, required: true },
    password: { type: String, required: true }
}, { collection: 'students' });

const Student = mongoose.model('Student', studentSchema);

// 3. API ĐĂNG NHẬP GIÁO VIÊN
app.post('/api/teacher-login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'ddd' && password === '123') {
        res.json({ message: "Success", token: "active_admin_session" });
    } else {
        res.status(401).json({ message: "Sai tài khoản giáo viên" });
    }
});

// 4. API ĐĂNG NHẬP HỌC SINH
app.post('/api/login', async (req, res) => {
    const { student_id, password } = req.body;
    try {
        const student = await Student.findOne({ student_id: student_id.trim() });
        if (!student) return res.status(401).json({ message: "Mã SV không tồn tại" });

        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) return res.status(401).json({ message: "Sai mật khẩu" });

        res.json({ message: "Success", name: student.name });
    } catch (err) {
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
});

// 5. API LẤY DANH SÁCH HỌC SINH (Dùng cho Admin)
app.get('/api/admin/students', async (req, res) => {
    try {
        const students = await Student.find({}, { password: 0 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: "Lỗi lấy dữ liệu" });
    }
});

// 6. KHỞI CHẠY SERVER
const PORT = process.env.PORT || 10000; // Render dùng 10000, Local dùng 10000
app.listen(PORT, () => {
    console.log(`🚀 Server live tại: http://localhost:${PORT}`);
});