const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { exec } = require('child_process'); // Thêm để chạy lệnh g++
const fs = require('fs'); // Thêm để quản lý file
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Tự động tạo thư mục 'temp' nếu chưa có để tránh lỗi
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

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

const questionSchema = new mongoose.Schema({
    question_id: String,
    content: String,
    level: String,
    test_cases: [{ input: String, expected: String }] // Đổi 'output' thành 'expected' để khớp logic mới
});
const Question = mongoose.model('Question', questionSchema, 'questions');

const resultSchema = new mongoose.Schema({
    student_id: String,
    question_id: String,
    correct: Boolean, 
    answer: String,
    score: String, // Thêm để lưu tỉ lệ test case đúng (ví dụ: 1/1)
    session_id: String,
    timestamp: { type: Date, default: Date.now }
});
const Result = mongoose.model('Result', resultSchema, 'results');

// --- HÀM HỖ TRỢ CHẠY FILE C++ ---
function runCode(exePath, input) {
    return new Promise((resolve) => {
        const child = exec(`"${exePath}"`, { timeout: 3000 }, (error, stdout, stderr) => {
            if (error) resolve(stderr || ""); 
            else resolve(stdout || "");
        });
        if (input) {
            child.stdin.write(input + "\n");
            child.stdin.end();
        }
    });
}

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
                session_id: "PHIÊN_" + Date.now() 
            });
        } else {
            res.status(401).json({ error: "Mật khẩu không đúng!" });
        }
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống học sinh" });
    }
});

// 6. API Lấy danh sách câu hỏi
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find();
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: "Không thể lấy danh sách câu hỏi" });
    }
});

// 7. API CHẤM BÀI (ĐÃ CẢI TIẾN TÍCH HỢP G++)
app.post('/api/check-answer', async (req, res) => {
    const { student_id, question_id, answer, session_id } = req.body;
    
    try {
        const question = await Question.findOne({ question_id });
        if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

        const safeCode = (answer || "").toString();
        const fileId = uuidv4();
        const cppPath = path.join(tempDir, `${fileId}.cpp`);
        const exePath = path.join(tempDir, `${fileId}.exe`);

        // 1. Lưu file tạm
        fs.writeFileSync(cppPath, safeCode);

        // 2. Biên dịch bằng g++
        exec(`g++ "${cppPath}" -o "${exePath}"`, async (compileError, stdout, stderr) => {
            if (compileError) {
                // Lỗi biên dịch (Compile Error)
                if (fs.existsSync(cppPath)) fs.unlinkSync(cppPath);
                return res.json({ success: true, correct: false, message: "Lỗi biên dịch!", details: stderr });
            }

            let passed = 0;
            const testCases = question.test_cases || [];

            // 3. Chạy các Test Case
            for (let test of testCases) {
                const output = await runCode(exePath, test.input);
                // Dùng trim() để loại bỏ xuống dòng/dấu cách thừa
                const expected = (test.expected || test.output || "").toString().trim();
                if (output.trim() === expected) {
                    passed++;
                }
            }

            // 4. Dọn dẹp file
            if (fs.existsSync(cppPath)) fs.unlinkSync(cppPath);
            if (fs.existsSync(exePath)) fs.unlinkSync(exePath);

            // 5. Lưu kết quả
            const isCorrect = (testCases.length > 0 && passed === testCases.length);
            const scoreDisplay = `${passed}/${testCases.length}`;

            const newResult = new Result({
                student_id,
                question_id,
                correct: isCorrect,
                answer: safeCode,
                score: scoreDisplay,
                session_id,
                timestamp: new Date()
            });

            await newResult.save();
            res.json({ 
                success: true, 
                correct: isCorrect, 
                passed, 
                total: testCases.length,
                message: isCorrect ? "Tuyệt vời! Bạn đã vượt qua tất cả bài kiểm tra." : `Bạn đúng ${passed}/${testCases.length} trường hợp.`
            });
        });

    } catch (err) {
        console.error("❌ Lỗi hệ thống chấm bài:", err);
        res.status(500).json({ error: "Lỗi trong quá trình chấm bài" });
    }
});

// 8. API Admin
app.get('/api/admin/results', async (req, res) => {
    try {
        const allResults = await Result.aggregate([
            {
                $lookup: {
                    from: 'students',
                    localField: 'student_id',
                    foreignField: 'student_id',
                    as: 'student_info'
                }
            },
            { $sort: { timestamp: -1 } }
        ]);
        res.json(allResults);
    } catch (err) {
        res.status(500).json({ error: "Không thể lấy dữ liệu báo cáo" });
    }
});

// 9. Xử lý SPA và Port
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 CodeBloom Server đang chạy tại cổng ${PORT}`);
});