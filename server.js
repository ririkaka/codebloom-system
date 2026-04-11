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
// Sử dụng chuỗi .env bạn đã cung cấp (đã đổi sang database codebloom để tránh lỗi Unauthorized)
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected: codebloom database'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });

// 2. ĐỊNH NGHĨA SCHEMA & MODEL (Khớp với Atlas)
const studentSchema = new mongoose.Schema({
    student_id: { type: String, required: true },
    name: { type: String, required: true },
    password: { type: String, required: true }
}, { collection: 'students' });

const resultSchema = new mongoose.Schema({
    student_id: String,
    score: Number,
    date: { type: Date, default: Date.now }
}, { collection: 'results' });

const Student = mongoose.model('Student', studentSchema);
const Result = mongoose.model('Result', resultSchema);

// 3. API ĐĂNG NHẬP HỌC SINH
app.post('/api/login', async (req, res) => {
    const { student_id, password } = req.body;
    try {
        // .trim() để tránh lỗi thừa dấu cách khi nhập
        const student = await Student.findOne({ student_id: student_id.trim() });
        
        if (!student) {
            return res.status(401).json({ message: "Mã SV không tồn tại" });
        }

        // So sánh mật khẩu bằng Bcrypt (khớp với mật khẩu đã mã hóa trong database)
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Sai mật khẩu" });
        }

        res.json({ message: "Success", name: student.name, student_id: student.student_id });
    } catch (err) {
        res.status(500).json({ message: "Lỗi hệ thống đăng nhập" });
    }
});

// 4. API ĐĂNG NHẬP GIÁO VIÊN
app.post('/api/teacher-login', (req, res) => {
    const { username, password } = req.body;
    // Tài khoản admin mặc định: ddd / 123
    if (username === 'ddd' && password === '123') {
        res.json({ message: "Success", token: "active_admin_session" });
    } else {
        res.status(401).json({ message: "Tài khoản giáo viên không đúng" });
    }
});

// 5. API DÀNH CHO TRANG ADMIN
app.get('/api/admin/students', async (req, res) => {
    try {
        const students = await Student.find({}, { password: 0 }); // Không gửi password về
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: "Lỗi truy xuất dữ liệu" });
    }
});

// 6. KHỞI CHẠY SERVER
// Ưu tiên cổng 10000 của Render
const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});