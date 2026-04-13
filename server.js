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
// Schema Giáo viên
const teacherSchema = new mongoose.Schema({
    teacher_id: String,
    t_name: String,
    t_password: String 
});
const Teacher = mongoose.model('Teacher', teacherSchema, 'teachers');

// Schema Học sinh
const studentSchema = new mongoose.Schema({
    student_id: String,
    name: String,
    password: String
});
const Student = mongoose.model('Student', studentSchema, 'students');

// Schema Câu hỏi
const questionSchema = new mongoose.Schema({
    question_id: String,
    content: String,
    level: String,
    test_cases: [{ input: String, output: String }] 
});
const Question = mongoose.model('Question', questionSchema, 'questions');

// Schema Kết quả bài làm
const resultSchema = new mongoose.Schema({
    student_id: String,
    question_id: String,
    correct: Boolean, 
    answer: String,
    session_id: String,
    timestamp: { type: Date, default: Date.now }
});
const Result = mongoose.model('Result', resultSchema, 'results');

// 4. API Đăng nhập Giáo viên
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
                session_id: "PHIEN_" + Date.now() 
            });
        } else {
            res.status(401).json({ error: "Mật khẩu không đúng!" });
        }
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống học sinh" });
    }
});

// 6. API Lấy danh sách câu hỏi cho Học sinh làm bài
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find();
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: "Không thể lấy danh sách câu hỏi" });
    }
});

// 7. API Chấm điểm và Lưu kết quả (Có phòng thủ dữ liệu)
app.post('/api/check-answer', async (req, res) => {
    try {
        const { student_id, question_id, answer, session_id } = req.body;

        const question = await Question.findOne({ question_id });
        if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

        // PHÒNG THỦ DỮ LIỆU: Chống lỗi .trim() của undefined/null
        const safeStudentAnswer = (answer || "").toString().trim();
        
        let isCorrect = false;

        if (question.test_cases && 
            question.test_cases.length > 0 && 
            question.test_cases[0].output !== undefined) {
            
            const expectedOutput = question.test_cases[0].output.toString().trim();
            isCorrect = (safeStudentAnswer === expectedOutput);
        }

        const newResult = new Result({
            student_id,
            question_id,
            correct: isCorrect,
            answer: safeStudentAnswer,
            session_id,
            timestamp: new Date()
        });

        await newResult.save();
        res.json({ success: true, correct: isCorrect });
    } catch (err) {
        console.error("❌ Lỗi chấm bài:", err.message);
        res.status(500).json({ error: "Lỗi trong quá trình xử lý kết quả" });
    }
});

// 8. API Lấy dữ liệu cho Admin Panel (ĐÃ CẢI TIẾN: Lấy tên từ bảng Students)
app.get('/api/admin/results', async (req, res) => {
    try {
        // Sử dụng Aggregate để "Join" bảng results với bảng students
        const allResults = await Result.aggregate([
            {
                $lookup: {
                    from: 'students',           // Tìm trong collection 'students'
                    localField: 'student_id',    // Trường student_id của bảng 'results'
                    foreignField: 'student_id',  // Khớp với student_id của bảng 'students'
                    as: 'student_info'           // Kết quả trả về nằm trong mảng 'student_info'
                }
            },
            { $sort: { timestamp: -1 } }         // Sắp xếp bài mới nhất lên đầu
        ]);
        res.json(allResults);
    } catch (err) {
        res.status(500).json({ error: "Không thể lấy dữ liệu báo cáo" });
    }
});

// 9. Xử lý đường dẫn ảo (SPA) và cổng Server
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 CodeBloom Server đang chạy tại cổng ${PORT}`);
});