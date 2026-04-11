const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 1. KẾT NỐI DATABASE
// Hãy đảm bảo mật khẩu và tên database 'CodeBloom' là chính xác
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/CodeBloom?retryWrites=true&w=majority";

mongoose.connect(mongoURI) // Đã loại bỏ useNewUrlParser và useUnifiedTopology
    .then(() => console.log('✅ MongoDB Connected: CodeBloom Database'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// 2. ĐỊNH NGHĨA SCHEMA
const studentSchema = new mongoose.Schema({
    student_id: String,
    name: String,
    password: { type: String, required: true }
}, { collection: 'students' });

const Student = mongoose.model('Student', studentSchema);

// 3. API ĐĂNG NHẬP GIÁO VIÊN (Dùng cho teacher-login.html)
app.post('/api/teacher-login', (req, res) => {
    const { username, password } = req.body;
    // Tài khoản mặc định: ddd / 123
    if (username === 'ddd' && password === '123') {
        res.json({ message: "Success", token: "teacher_active_" + Date.now() });
    } else {
        res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu giáo viên" });
    }
});

// 4. API ĐĂNG NHẬP HỌC SINH (Dùng bcrypt cho student_id 002)
app.post('/api/login', async (req, res) => {
    const { student_id, password } = req.body;
    try {
        const student = await Student.findOne({ student_id });
        if (!student) return res.status(401).json({ message: "Mã SV không tồn tại" });

        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) return res.status(401).json({ message: "Mật khẩu không khớp" });

        res.json({ message: "Success", name: student.name });
    } catch (err) {
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
});

// 5. KHỞI CHẠY SERVER
const PORT = process.env.PORT || 10000; // Render dùng cổng 10000
app.listen(PORT, () => {
    console.log(`🚀 Server live tại: http://localhost:${PORT}`);
});