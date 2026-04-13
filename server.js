const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

// --- 1. MIDDLEWARE ---
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "codebloom_secret_key";
const mongoURI = process.env.MONGODB_URI || "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";

// Render dùng /tmp để có quyền ghi file
const tempDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// --- 3. KẾT NỐI DATABASE ---
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Kết nối thành công MongoDB'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err.message));

// --- 4. ĐỊNH NGHĨA MODELS ---
const Teacher = mongoose.model('Teacher', new mongoose.Schema({
    teacher_id: { type: String, required: true, unique: true },
    t_name: String,
    t_password: { type: String, required: true }
}, { collection: 'teachers' }));

const Student = mongoose.model('Student', new mongoose.Schema({
    student_id: { type: String, required: true, unique: true },
    name: String,
    password: { type: String, required: true }
}, { collection: 'students' }));

const Question = mongoose.model('Question', new mongoose.Schema({
    question_id: String,
    test_cases: [{ input: String, expected: String }]
}, { collection: 'questions' }));

const Result = mongoose.model('Result', new mongoose.Schema({
    student_id: String,
    question_id: String,
    session_id: String,
    code: String,
    correct: Boolean, // Đổi thành Boolean khớp với yêu cầu của bạn
    status: String,
    submittedAt: { type: Date, default: Date.now }
}, { collection: 'results' }));

// --- 5. CÁC API ENDPOINTS ---

// API Đăng nhập cho Giáo viên
app.post('/api/teacher-login', async (req, res) => {
    try {
        const { teacher_id, password } = req.body;
        const teacher = await Teacher.findOne({ teacher_id: teacher_id.trim() });
        if (!teacher) return res.status(401).json({ error: "Giáo viên không tồn tại" });

        const isMatch = await bcrypt.compare(password, teacher.t_password).catch(() => password === teacher.t_password);
        if (!isMatch) return res.status(401).json({ error: "Mật khẩu không đúng" });

        const token = jwt.sign({ id: teacher._id, role: 'teacher' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: "Success", token, name: teacher.t_name });
    } catch (err) {
        res.status(500).json({ error: "Lỗi Server" });
    }
});

// API Đăng nhập cho Học sinh
app.post('/api/login', async (req, res) => {
    try {
        const { student_id, password } = req.body;
        const student = await Student.findOne({ student_id: student_id.trim() });
        if (!student) return res.status(401).json({ error: "Học sinh không tồn tại" });

        // Kiểm tra mật khẩu (hỗ trợ cả bcrypt và text thuần cho sáng kiến)
        const isMatch = await bcrypt.compare(password, student.password).catch(() => password === student.password);
        if (!isMatch) return res.status(401).json({ error: "Mật khẩu không đúng" });

        const token = jwt.sign({ id: student._id, role: 'student' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
            message: "Success", 
            token, 
            student_id: student.student_id, 
            name: student.name,
            session_id: "PHIEN_1"
        });
    } catch (err) {
        res.status(500).json({ error: "Lỗi Server" });
    }
});

// API Chấm bài tự động (GCC)
app.post('/api/submit', async (req, res) => {
    const { student_id, question_id, session_id, code } = req.body;
    const question = await Question.findOne({ question_id });
    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

    const id = uuidv4();
    const filePath = path.join(tempDir, `${id}.c`);
    const isWindows = process.platform === "win32";
    const exePath = isWindows ? path.join(tempDir, `${id}.exe`) : path.join(tempDir, id);

    fs.writeFileSync(filePath, code);

    exec(`gcc "${filePath}" -o "${exePath}"`, async (err, stdout, stderr) => {
        if (err) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.json({ isCorrect: false, status: "Compile Error", error: stderr });
        }

        let passed = true;
        let logs = "";

        for (let tc of question.test_cases) {
            try {
                const output = await new Promise((resolve, reject) => {
                    const runCmd = isWindows ? `"${exePath}"` : `./${id}`;
                    const child = exec(runCmd, { cwd: tempDir, timeout: 2000 }, (e, stdout) => e ? reject(e) : resolve(stdout.trim()));
                    if (tc.input) { child.stdin.write(tc.input + "\n"); child.stdin.end(); }
                });
                if (output !== tc.expected.trim()) { passed = false; break; }
            } catch { passed = false; break; }
        }

        // Lưu kết quả vào MongoDB (Dùng updateOne với upsert để không trùng lặp)
        await Result.updateOne(
            { student_id, question_id, session_id },
            { 
                code, 
                correct: passed, 
                status: passed ? "Accepted" : "Wrong Answer",
                submittedAt: new Date()
            },
            { upsert: true }
        );

        // Dọn dẹp file tạm
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(exePath)) fs.unlinkSync(exePath);

        res.json({ isCorrect: passed, status: passed ? "Accepted" : "Wrong Answer" });
    });
});

// Các API lấy dữ liệu
app.get('/api/students', async (req, res) => res.json(await Student.find()));
app.get('/api/results', async (req, res) => res.json(await Result.find().sort({ submittedAt: -1 })));

// --- 6. KHỞI CHẠY SERVER ---
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});