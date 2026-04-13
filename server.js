const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. Phục vụ file tĩnh từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

// 2. Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Kết nối MongoDB thành công'))
    .catch(err => console.error('❌ Lỗi kết nối DB:', err));

// 3. Định nghĩa Schemas
const teacherSchema = new mongoose.Schema({
    teacher_id: String,
    t_name: String,
    t_password: String 
});
const Teacher = mongoose.model('Teacher', teacherSchema, 'teachers');

const studentSchema = new mongoose.Schema({
    student_id: String,
    name: String,
    password: String
});
const Student = mongoose.model('Student', studentSchema, 'students');

// 4. API Đăng nhập Giáo viên (Giải mã Bcrypt)
app.post('/api/teacher-login', async (req, res) => {
    try {
        const { teacher_id, password } = req.body;
        const teacher = await Teacher.findOne({ teacher_id });
        
        if (!teacher || !(await bcrypt.compare(password, teacher.t_password))) {
            return res.status(401).json({ error: "Mã giáo viên hoặc mật khẩu không đúng!" });
        }

        res.json({ success: true, token: "tc-" + uuidv4(), name: teacher.t_name });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống giáo viên" });
    }
});

// 5. API Đăng nhập Học sinh
app.post('/api/login', async (req, res) => {
    try {
        const { student_id, password } = req.body;
        const student = await Student.findOne({ student_id });

        if (!student) return res.status(401).json({ error: "Mã học sinh không tồn tại!" });

        // Kiểm tra Bcrypt, nếu lỗi (do mật khẩu thuần) thì so sánh trực tiếp
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, student.password);
        } catch (e) {
            isMatch = (password === student.password);
        }

        if (isMatch) {
            res.json({ 
                success: true, 
                token: "st-" + uuidv4(), 
                student_id: student.student_id, 
                name: student.name,
                session_id: uuidv4()
            });
        } else {
            res.status(401).json({ error: "Mật khẩu không đúng!" });
        }
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống học sinh" });
    }
});

// 6. Sửa lỗi "Cannot GET" - Chuyển mọi request không phải API về index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server chạy tại port ${PORT}`));