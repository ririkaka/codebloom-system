require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let db;

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

// 🔐 Xác thực token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function verifyTeacherToken(token) {
  const decoded = verifyToken(token);
  return decoded && decoded.role === 'teacher';
}

async function main() {
  await client.connect();
  db = client.db();

  // 🔐 Đăng nhập sinh viên
  app.post('/login', async (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });

    const token = jwt.sign({ student_id, role: 'student' }, JWT_SECRET);
    res.json({ token });
  });

  // 🔐 Đăng nhập giáo viên
  app.post('/teacher-login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'teacher' && password === '123456') {
      const token = jwt.sign({ username, role: 'teacher' }, JWT_SECRET);
      return res.json({ token });
    } else {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    }
  });

  // 📚 Lấy danh sách câu hỏi
  app.get('/questions', async (req, res) => {
    const questions = await db.collection('questions').find().toArray();
    res.json(questions);
  });

  // 📥 Nộp bài - lưu vào "results"
  app.post('/submit', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { question_id, code, session_id } = req.body;
    const student_id = decoded.student_id;

    if (!question_id || !code || !session_id) {
      return res.status(400).json({ error: 'Thiếu dữ liệu' });
    }

    // 🔍 Chấm điểm đơn giản: có từ "print" là đúng
    const correct = code.includes("print");

    await db.collection('results').insertOne({
      student_id,
      question_id,
      session_id,
      code,
      correct,
      submittedAt: new Date()
    });

    res.json({ result: correct ? "✅ Đúng" : "❌ Sai" });
  });

  // 📊 Tạo tổng hợp kết quả từ "results"
  app.get('/result-summary', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const results = await db.collection('results').find().toArray();

    const summaryMap = {};

    results.forEach(r => {
      const sid = r.student_id;
      if (!summaryMap[sid]) {
        summaryMap[sid] = {
          _id: sid,
          answers: [],
          correctCount: 0,
          wrongCount: 0
        };
      }

      summaryMap[sid].answers.push({
        question_id: r.question_id,
        correct: r.correct
      });

      if (r.correct) summaryMap[sid].correctCount += 1;
      else summaryMap[sid].wrongCount += 1;
    });

    res.json(Object.values(summaryMap));
  });

  // 🧑‍🎓 Lấy danh sách sinh viên
  app.get('/students', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const students = await db.collection('students').find().toArray();
    res.json(students);
  });

  // 📝 Lưu tổng kết từng phiên (tùy chọn)
  app.post('/summary', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { student_id, correct, incorrect, total, session_id } = req.body;
    await db.collection('summaries').insertOne({
      student_id,
      correct,
      incorrect,
      total,
      session_id,
      createdAt: new Date()
    });

    res.json({ message: 'Tổng kết đã lưu' });
  });

  // ✅ Start server
  app.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  });
}

main();
