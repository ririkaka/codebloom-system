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
// LƯU Ý: Thay đổi password và tên database 'CodeBloom' cho đúng
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/CodeBloom?retryWrites=true&w=majority";

mongoose.connect(mongoURI) // Đã xóa useNewUrlParser và useUnifiedTopology để fix lỗi
    .then(() => {
        console.log('✅ MongoDB Connected: CodeBloom Database'); // Xác nhận kết nối thành công
    })
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
    });

// 2. SCHEMA (Khớp với cấu trúc database thực tế của bạn)
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

        // So sánh mật khẩu bằng Bcrypt
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
const PORT = process.env.PORT || 10000; // Port 10000 khớp với Log của bạn
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📂 Folder giao diện: /public`);
});