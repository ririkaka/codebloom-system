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
// CHÚ Ý: Thay 'local' bằng tên database hiển thị trong Atlas của bạn nếu cần
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/CodeBloomDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI) // Đã loại bỏ các options không hỗ trợ ở bản mới
    .then(() => console.log('✅ MongoDB Connected: Database Loaded!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// 2. ĐỊNH NGHĨA SCHEMA (Phải khớp chính xác tên trường trong ảnh image_8a6f2f.png)
const studentSchema = new mongoose.Schema({
    student_id: { type: String, required: true },
    name: { type: String, required: true },
    password: { type: String, required: true }
}, { collection: 'students' }); // Chỉ định rõ collection 'students'

const Student = mongoose.model('Student', studentSchema);

// 3. API ĐĂNG NHẬP HỌC SINH
app.post('/api/login', async (req, res) => {
    // Dùng .trim() để loại bỏ khoảng trắng thừa nếu có
    const student_id = req.body.student_id ? req.body.student_id.trim() : "";
    const password = req.body.password;

    try {
        // Tìm kiếm chính xác student_id
        const student = await Student.findOne({ student_id: student_id });
        
        if (!student) {
            return res.status(401).json({ message: "Mã SV không tồn tại" });
        }

        // So sánh mật khẩu mã hóa bcrypt
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Sai mật khẩu" });
        }

        res.json({ 
            message: "Success", 
            name: student.name,
            student_id: student.student_id 
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Lỗi Server" });
    }
});

// 4. API ĐĂNG NHẬP GIÁO VIÊN
app.post('/api/teacher-login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'ddd' && password === '123') { // Tài khoản test của bạn
        res.json({ message: "Success" });
    } else {
        res.status(401).json({ message: "Sai tài khoản giáo viên" });
    }
});

// 5. KHỞI CHẠY SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server live tại: http://localhost:${PORT}`);
    console.log(`📂 Folder giao diện: /public`);
});