const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔗 Kết nối MongoDB (Đảm bảo đã mở Network Access 0.0.0.0/0)
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("✅ MongoDB Connected")).catch(err => console.log(err));

// 📦 Định nghĩa Schema
const Result = mongoose.model('Result', new mongoose.Schema({
    studentId: String, question_id: String, session_id: String, correct: Boolean
}));
const Student = mongoose.model('Student', new mongoose.Schema({
    student_id: { type: String, unique: true }, name: String
}));

// 🔐 API Đăng nhập giáo viên (Xử lý khớp với teachers.json)
app.post('/api/teacher/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const teachers = JSON.parse(fs.readFileSync(path.join(__dirname, 'teachers.json'), 'utf8'));
        const teacher = teachers.find(t => t.t_name === username && String(t.t_password) === String(password));
        if (teacher) res.json({ success: true, token: "valid" });
        else res.status(401).json({ success: false, message: "Sai tài khoản" });
    } catch (err) { res.status(500).json({ error: "Lỗi đọc file teachers.json" }); }
});

// 📌 API Dữ liệu (Đảm bảo có tiền tố /api/)
app.get('/api/results', async (req, res) => {
    const data = await Result.find().sort({ createdAt: -1 });
    res.json(data);
});

app.get('/api/students', async (req, res) => {
    const data = await Student.find();
    res.json(data);
});

// Chặn lỗi "Unexpected token <" bằng cách kiểm tra đường dẫn
app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api/')) return next(); 
    res.sendFile(path.join(__dirname, 'public/role-select.html'));
});

app.listen(process.env.PORT || 5000);