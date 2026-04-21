const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { exec } = require('child_process');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Tự động tạo thư mục 'temp' nếu chưa có
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
    test_cases: [{ input: String, expected: String }]
});
const Question = mongoose.model('Question', questionSchema, 'questions');

const resultSchema = new mongoose.Schema({
    student_id: String,
    question_id: String,
    correct: Boolean, 
    answer: String,
    score: String, 
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

// 7. API CHẤM BÀI C++
app.post('/api/check-answer', async (req, res) => {
    const { student_id, question_id, answer, session_id } = req.body;
    
    try {
        const question = await Question.findOne({ question_id });
        if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

        const safeCode = (answer || "").toString();
        const fileId = uuidv4();
        const cppPath = path.join(tempDir, `${fileId}.cpp`);
        const exePath = path.join(tempDir, `${fileId}.exe`);

        fs.writeFileSync(cppPath, safeCode);

        exec(`g++ "${cppPath}" -o "${exePath}"`, async (compileError, stdout, stderr) => {
            if (compileError) {
                if (fs.existsSync(cppPath)) fs.unlinkSync(cppPath);
                return res.json({ success: true, correct: false, message: "Lỗi biên dịch!", details: stderr });
            }

            let passed = 0;
            const testCases = question.test_cases || [];

            for (let test of testCases) {
                const output = await runCode(exePath, test.input);
                const expected = (test.expected || test.output || "").toString().trim();
                if (output.trim() === expected) {
                    passed++;
                }
            }

            if (fs.existsSync(cppPath)) fs.unlinkSync(cppPath);
            if (fs.existsSync(exePath)) fs.unlinkSync(exePath);

            const isCorrect = (testCases.length > 0 && passed === testCases.length);
            const scoreDisplay = `${passed}/${testCases.length}`;

            // Lưu hoặc cập nhật kết quả (nếu làm lại câu đó trong cùng 1 phiên)
            await Result.findOneAndUpdate(
                { student_id, question_id, session_id },
                { 
                    correct: isCorrect, 
                    answer: safeCode, 
                    score: scoreDisplay, 
                    timestamp: new Date() 
                },
                { upsert: true }
            );

            res.json({ 
                success: true, 
                correct: isCorrect, 
                passed, 
                total: testCases.length 
            });
        });

    } catch (err) {
        res.status(500).json({ error: "Lỗi trong quá trình chấm bài" });
    }
});

// 8. API BỔ SUNG: Lấy thông tin chi tiết Đúng/Sai/Chưa làm cho thông báo kết quả
app.get('/api/session-summary/:student_id/:session_id', async (req, res) => {
    try {
        const { student_id, session_id } = req.params;

        // Lấy tất cả câu hỏi để biết tổng số bài
        const allQuestions = await Question.find({}, 'question_id');
        const totalCount = allQuestions.length;

        // Lấy các bài học sinh đã nộp trong phiên này
        const studentResults = await Result.find({ student_id, session_id });

        let dung = 0;
        let sai = 0;
        const submittedIds = new Set();

        studentResults.forEach(r => {
            if (r.correct) dung++;
            else sai++;
            submittedIds.add(r.question_id);
        });

        const chuaLam = totalCount - submittedIds.size;

        res.json({
            success: true,
            dung,
            sai,
            chuaLam,
            tongSoCau: totalCount
        });
    } catch (err) {
        res.status(500).json({ error: "Lỗi lấy thống kê phiên làm việc" });
    }
});

// 9. API Admin
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

// 10. Xử lý SPA và Port
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 CodeBloom Server đang chạy tại cổng ${PORT}`);
});