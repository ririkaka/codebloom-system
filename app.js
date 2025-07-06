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

  // 🔑 Đăng nhập sinh viên
  app.post('/login', async (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });

    const token = jwt.sign({ student_id, role: 'student' }, JWT_SECRET);
    res.json({ token });
  });

  // 🔐 Đăng nhập giáo viên dùng collection teachers
  app.post('/teacher-login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Thiếu tên đăng nhập hoặc mật khẩu' });

    const teacher = await db.collection('teachers').findOne({ t_name: username });
    if (!teacher) return res.status(401).json({ error: 'Tên đăng nhập không tồn tại' });

    const match = await bcrypt.compare(password, teacher.t_password);
    if (!match) return res.status(401).json({ error: 'Sai mật khẩu' });

    const token = jwt.sign({ username, role: 'teacher' }, JWT_SECRET);
    res.json({ token });
  });

  // 📋 Danh sách câu hỏi
  app.get('/questions', async (req, res) => {
    const questions = await db.collection('questions').find().toArray();
    res.json(questions);
  });

  // 📩 Nộp bài (lưu vào collection "results")
  app.post('/submit', async (req, res) => {
    const auth = req.headers.authorization;
    const token = auth && auth.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { question_id, code, session_id } = req.body;
    const student_id = decoded.student_id;
    if (!question_id || !code || !session_id)
      return res.status(400).json({ error: 'Thiếu dữ liệu' });

    const correct = code.includes("print"); // Giả lập chấm điểm

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

  // 📊 Ghi tổng kết bài làm
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

  // 📘 API giáo viên: danh sách sinh viên
  app.get('/students', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const students = await db.collection('students').find().toArray();
    res.json(students);
  });

  // 📋 API giáo viên: kết quả chi tiết (results)
  app.get('/results', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const results = await db.collection('results').find().toArray();
    res.json(results);
  });

  // ✅ Khởi chạy server
  app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
}

main();
