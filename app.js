require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let db;

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
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

  // 👉 Đăng nhập sinh viên
  app.post('/login', async (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });

    const token = jwt.sign({ student_id, role: 'student' }, JWT_SECRET);
    res.json({ token });
  });

  // 👉 Đăng nhập giáo viên theo collection "teachers"
  app.post('/teacher-login', async (req, res) => {
    const { teacher_id, t_password } = req.body;
    if (!teacher_id || !t_password) return res.status(400).json({ error: 'Thiếu thông tin' });

    const teacher = await db.collection('teachers').findOne({ teacher_id });
    if (!teacher) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });

    const isMatch = await bcrypt.compare(t_password, teacher.t_password);
    if (!isMatch) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });

    const token = jwt.sign({ teacher_id, role: 'teacher' }, JWT_SECRET);
    res.json({ token });
  });

  // 👉 Danh sách câu hỏi
  app.get('/questions', async (req, res) => {
    const questions = await db.collection('questions').find().toArray();
    res.json(questions);
  });

  // 👉 API gợi ý phiên tiếp theo cho sinh viên
  app.get('/next-session-id', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { student_id } = decoded;
    const latest = await db.collection('results')
      .find({ student_id })
      .sort({ submittedAt: -1 })
      .limit(1)
      .toArray();

    let nextSession = "1";
    if (latest.length > 0 && latest[0].session_id) {
      const current = parseInt(latest[0].session_id);
      nextSession = (current + 1).toString();
    }

    res.json({ nextSession });
  });

  // 👉 Nộp bài
  app.post('/submit', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { question_id, code, session_id } = req.body;
    const student_id = decoded.student_id;

    if (!question_id || !code || !session_id) {
      return res.status(400).json({ error: 'Thiếu dữ liệu' });
    }

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

  // 👉 Lưu tổng kết (không bắt buộc)
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

  // 👉 API giáo viên: lấy danh sách sinh viên
  app.get('/students', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const students = await db.collection('students').find().toArray();
    res.json(students);
  });

  // 👉 API giáo viên: lấy kết quả (results)
  app.get('/results', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const results = await db.collection('results').find().toArray();
    res.json(results);
  });

  app.listen(PORT, () => console.log(`✅ Server chạy tại http://localhost:${PORT}`));
}

main();
