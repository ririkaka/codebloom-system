require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Phục vụ file tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let db;

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

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

  // 👉 Đăng nhập học sinh
  app.post('/login', async (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });

    const token = jwt.sign({ student_id, role: 'student' }, JWT_SECRET);
    res.json({ token });
  });

  // 👉 Đăng nhập giáo viên từ collection `teachers`
  app.post('/teacher-login', async (req, res) => {
  const { teacher_id, password } = req.body;
  const teacher = await db.collection('teachers').findOne({ teacher_id });

  if (!teacher) {
    return res.status(401).json({ error: "Không tìm thấy giáo viên" });
  }

  const match = await bcrypt.compare(password, teacher.t_password);
  if (!match) {
    return res.status(401).json({ error: "Sai mật khẩu" });
  }

  const token = jwt.sign({ teacher_id, role: 'teacher' }, JWT_SECRET);
  res.json({ token });
});
  // 👉 Lấy danh sách câu hỏi
  app.get('/questions', async (req, res) => {
    const questions = await db.collection('questions').find().toArray();
    res.json(questions);
  });

  // 👉 Nộp bài
  app.post('/submit', async (req, res) => {
    const auth = req.headers.authorization;
    const token = auth && auth.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { question_id, code, session_id } = req.body;
    const student_id = decoded.student_id;

    if (!question_id || !code || !session_id) {
      return res.status(400).json({ error: 'Thiếu dữ liệu' });
    }

    // Giả lập chấm điểm
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

  // 👉 Tổng kết sau khi nộp xong
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

  // 👉 Danh sách sinh viên
  app.get('/students', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const students = await db.collection('students').find().toArray();
    res.json(students);
  });

  // 👉 Danh sách kết quả nộp bài (results)
  app.get('/results', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const results = await db.collection('results').find().toArray();
    res.json(results);
  });

  // 👉 Tổng hợp kết quả theo sinh viên
  app.get('/result-summary', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const results = await db.collection('results').find().toArray();

    const summaries = {};

    for (const r of results) {
      if (!summaries[r.student_id]) {
        summaries[r.student_id] = {
          _id: r.student_id,
          correctCount: 0,
          wrongCount: 0,
          answers: []
        };
      }

      summaries[r.student_id].answers.push({
        question_id: r.question_id,
        correct: r.correct
      });

      if (r.correct) summaries[r.student_id].correctCount++;
      else summaries[r.student_id].wrongCount++;
    }

    res.json(Object.values(summaries));
  });

  app.listen(PORT, () => console.log(`✅ Server đang chạy tại http://localhost:${PORT}`));
}

main();
