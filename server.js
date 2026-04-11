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

// Render dùng /tmp để có quyền ghi file, máy cá nhân dùng thư mục temp
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
    student_id: String,
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

        const isMatch = await bcrypt.compare(password, teacher.t_password);
        if (!isMatch) return res.status(401).json({ error: "Mật khẩu không đúng" });

        const token = jwt.sign({ id: teacher._id, role: 'teacher' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ message: "Success", token, name: teacher.t_name });
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
    
    // Kiểm tra hệ điều hành để đặt tên file thực thi phù hợp
    const isWindows = process.platform === "win32";
    const exePath = isWindows ? path.join(tempDir, `${id}.exe`) : path.join(tempDir, id);

    fs.writeFileSync(filePath, code);

    // Biên dịch bằng GCC
    exec(`gcc "${filePath}" -o "${exePath}"`, async (err) => {
        if (err) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.json({ isCorrect: false, error: "Lỗi biên dịch" });
        }

        let passed = true;
        for (let tc of question.test_cases) {
            try {
                const output = await new Promise((resolve, reject) => {
                    const runCmd = isWindows ? `"${exePath}"` : `./${id}`;
                    // Cần thiết lập cwd (Current Working Directory) là tempDir trên Linux
                    const child = exec(runCmd, { cwd: tempDir }, (e, stdout) => e ? reject(e) : resolve(stdout.trim()));
                    
                    if (tc.input) { 
                        child.stdin.write(tc.input + "\n"); 
                        child.stdin.end(); 
                    }
                });
                if (output !== tc.expected.trim()) { passed = false; break; }
            } catch { passed = false; break; }
        }

        // Lưu kết quả chấm vào Database
        await Result.create({ 
            student_id, question_id, session_id, code, 
            status: passed ? "Đúng" : "Sai" 
        });

        // Xóa file rác sau khi chấm xong
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(exePath)) fs.unlinkSync(exePath);

        res.json({ isCorrect: passed });
    });
});

app.get('/api/students', async (req, res) => res.json(await Student.find()));
app.get('/api/results', async (req, res) => res.json(await Result.find()));

// --- 6. KHỞI CHẠY SERVER ---
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server đang chạy tại cổng ${PORT}`);
});