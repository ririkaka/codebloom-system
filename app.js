require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // phục vụ file tĩnh từ thư mục public

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

const client = new MongoClient(mongoUri);
let db;

// 🛡️ Middleware kiểm tra JWT
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

function verifyStudentToken(token) {
  const decoded = verifyToken(token);
  return decoded && decoded.role === 'student';
}

// 🏁 Chuyển hướng từ "/" đến role-select.html
app.get('/', (req, res) => {
  res.redirect('/role-select.html');
});

// 🔑 Đăng nhập sinh viên
app.post('/login', async (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });

  const token = jwt.sign({ student_id, role: 'student' }, JWT_SECRET);
  res.json({ token });
});

// 🔑 Đăng nhập giáo viên (từ collection "teachers")
app.post('/teacher-login', async (req, res) => {
  const { teacher_id, t_password } = req.body;
  const teacher = await db.collection('teachers').findOne({ teacher_id, t_password });

  if (!teacher) return res.status(401).json({ error: 'Sai thông tin đăng nhập' });

  const token = jwt.sign({ teacher_id, role: 'teacher' }, JWT_SECRET);
  res.json({ token });
});

// 📚 Danh sách câu hỏi
app.get('/questions', async (req, res) => {
  const questions = await db.collection('questions').find().toArray();
  res.json(questions);
});

// 📝 Nộp bài → lưu vào collection "results"
app.post('/submit', async (req, res) => {
  const auth = req.headers.authorization;
  const token = auth && auth.split(' ')[1];
  const decoded = verifyStudentToken(token);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { question_id, code, session_id } = req.body;
  const student_id = decoded.student_id;

  if (!question_id || !code || !session_id) {
    return res.status(400).json({ error: 'Thiếu dữ liệu' });
  }

  const correct = code.includes("print"); // 🎯 Chấm đơn giản
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

// 📊 API giáo viên: lấy danh sách sinh viên
app.get('/students', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

  const students = await db.collection('students').find().toArray();
  res.json(students);
});

// 📊 API giáo viên: lấy kết quả tổng hợp theo phiên mới nhất
app.get('/result-summary', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

  const latestSession = await db.collection('results').find()
    .sort({ submittedAt: -1 }).limit(1).toArray();

  if (latestSession.length === 0) return res.json([]);

  const latestSessionId = latestSession[0].session_id;

  const rawResults = await db.collection('results')
    .find({ session_id: latestSessionId }).toArray();

  const grouped = {};

  for (const r of rawResults) {
    if (!grouped[r.student_id]) {
      grouped[r.student_id] = {
        _id: r.student_id,
        answers: [],
        correctCount: 0,
        wrongCount: 0
      };
    }
    grouped[r.student_id].answers.push({ question_id: r.question_id, correct: r.correct });
    if (r.correct) grouped[r.student_id].correctCount++;
    else grouped[r.student_id].wrongCount++;
  }

  res.json(Object.values(grouped));
});

// 🚀 Khởi động server
async function start() {
  await client.connect();
  db = client.db(); // mặc định db
  app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
}

start();
