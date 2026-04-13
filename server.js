const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Kết nối thành công MongoDB'))
    .catch(err => console.error('❌ Lỗi kết nối:', err));

// Định nghĩa Models
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

// API: Lấy danh sách câu hỏi
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find({});
        res.json(questions);
    } catch (err) {
        res.status(500).json({ error: "Lỗi tải câu hỏi" });
    }
});

// API: Lấy toàn bộ kết quả (để tính toán thống kê)
app.get('/api/results', async (req, res) => {
    try {
        const results = await Result.find({});
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Lỗi tải kết quả" });
    }
});

// API: Chấm bài ngôn ngữ C
app.post('/api/submit', async (req, res) => {
    const { student_id, question_id, session_id, code } = req.body;
    const question = await Question.findOne({ question_id });

    if (!question) return res.status(404).json({ error: "Không thấy câu hỏi" });

    const id = uuidv4();
    const tempDir = '/tmp'; 
    const filePath = path.join(tempDir, `${id}.c`);
    const exePath = path.join(tempDir, id);

    fs.writeFileSync(filePath, code);

    // Biên dịch bằng GCC
    exec(`gcc "${filePath}" -o "${exePath}"`, async (compileErr) => {
        if (compileErr) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.json({ isCorrect: false, error: "Lỗi biên dịch C" });
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

                if (output !== tc.expected.trim()) {
                    allPassed = false;
                    break;
                }
            } catch {
                allPassed = false;
                break;
            }
        }

        // Cập nhật kết quả vào MongoDB
        await Result.updateOne(
            { student_id, question_id, session_id },
            { correct: allPassed, code, submittedAt: new Date() },
            { upsert: true }
        );

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(exePath)) fs.unlinkSync(exePath);

        res.json({ isCorrect: allPassed });
    });
});

app.listen(10000, "0.0.0.0", () => console.log('🚀 Server đang chạy tại cổng 10000'));