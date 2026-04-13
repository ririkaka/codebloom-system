const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- [SỬA LỖI CANNOT GET] PHỤC VỤ FILE TĨNH ---
// Đảm bảo các file html của bạn nằm trong thư mục tên là 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- KẾT NỐI DATABASE ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Đã kết nối MongoDB thành công'))
    .catch(err => console.error('❌ Lỗi kết nối DB:', err));

// --- ĐỊNH NGHĨA SCHEMA ---
const Question = mongoose.model('Question', new mongoose.Schema({
    question_id: String,
    content: String,
    test_cases: [{ input: String, expected: String }]
}), 'questions');

const Result = mongoose.model('Result', new mongoose.Schema({
    student_id: String,
    question_id: String,
    correct: Boolean,
    session_id: String,
    code: String,
    submittedAt: { type: Date, default: Date.now }
}), 'results');

// --- CÁC API XỬ LÝ DỮ LIỆU ---

// [SỬA LỖI TẢI CÂU HỎI]
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find({});
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: "Không thể lấy dữ liệu câu hỏi" });
    }
});

// [SỬA LỖI TRUY XUẤT BẢNG ĐIỂM/THỐNG KÊ]
app.get('/api/results', async (req, res) => {
    try {
        const results = await Result.find({});
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Không thể lấy bảng điểm" });
    }
});

// API CHẤM BÀI CODE C
app.post('/api/submit', async (req, res) => {
    const { student_id, question_id, session_id, code } = req.body;
    const question = await Question.findOne({ question_id });

    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

    const id = uuidv4();
    const tempDir = '/tmp'; // Dùng thư mục /tmp để chạy được trên Render
    const filePath = path.join(tempDir, `${id}.c`);
    const exePath = path.join(tempDir, id);

    fs.writeFileSync(filePath, code);

    // Biên dịch GCC
    exec(`gcc "${filePath}" -o "${exePath}"`, async (compileErr) => {
        if (compileErr) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.json({ isCorrect: false, error: "Lỗi biên dịch code C" });
        }

        let allPassed = true;
        for (let tc of question.test_cases) {
            try {
                const output = await new Promise((resolve, reject) => {
                    const child = exec(`${exePath}`, { timeout: 2000 }, (runErr, stdout) => {
                        if (runErr) reject(runErr);
                        else resolve(stdout.trim());
                    });
                    if (tc.input) {
                        child.stdin.write(tc.input + "\n");
                        child.stdin.end();
                    }
                });
                if (output !== tc.expected.trim()) { allPassed = false; break; }
            } catch { allPassed = false; break; }
        }

        // Lưu kết quả vào MongoDB
        await Result.updateOne(
            { student_id, question_id, session_id },
            { correct: allPassed, code, submittedAt: new Date() },
            { upsert: true }
        );

        // Dọn dẹp file tạm
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
        
        res.json({ isCorrect: allPassed });
    });
});

// --- [SỬA LỖI CANNOT GET] ĐIỀU HƯỚNG DỰ PHÒNG ---
app.get('/teacher-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher-login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Chấp nhận mọi trang .html khác trong thư mục public
app.get('/:page.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${req.params.page}.html`));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server đang chạy tại cổng: ${PORT}`);
});