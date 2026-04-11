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
// Thay đổi 'mat_khau_cua_ban' thành mật khẩu thật của bạn
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/CodeBloom?retryWrites=true&w=majority";

// FIX: Đã xóa các options lỗi (useNewUrlParser, useUnifiedTopology)
mongoose.connect(mongoURI)
    .then(() => {
        console.log('✅ MongoDB Connected: CodeBloom Database');
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });

// 2. ĐỊNH NGHĨA SCHEMA (Khớp với cấu trúc database của bạn)
const studentSchema = new mongoose.Schema({
    student_id: { type: String, required: true },
    name: { type: String, required: true },
    password: { type: String, required: true }
}, { collection: 'students' });

const Student = mongoose.model('Student', studentSchema);

// 3. API ĐĂNG NHẬP
app.post('/api/login', async (req, res) => {
    const { student_id, password } = req.body;
    try {
        const student = await Student.findOne({ student_id });
        if (!student) {
            return res.status(401).json({ message: "Mã số học sinh không tồn tại!" });
        }

        // Kiểm tra mật khẩu mã hóa bcrypt
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Mật khẩu không chính xác!" });
        }

        res.json({ 
            message: "Success", 
            name: student.name, 
            student_id: student.student_id 
        });
    } catch (err) {
        res.status(500).json({ message: "Lỗi hệ thống khi đăng nhập" });
    }
});

// 4. KHỞI CHẠY SERVER
const PORT = process.env.PORT || 10000; // Khớp với cổng Render yêu cầu
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📂 Thư mục công khai: /public`);
});