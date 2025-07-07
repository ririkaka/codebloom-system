require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

const client = new MongoClient(mongoUri);
let db;

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

  // 🔐 Đăng nhập học sinh
  app.post('/login', async (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });

    const token = jwt.sign({ student_id, role: 'student' }, JWT_SECRET);
    res.json({ token });
  });

  // 🔐 Đăng nhập giáo viên từ collection "teachers"
  app.post('/teacher-login', async (req, res) => {
    const { username, password } = req.body;
    const teacher = await db.collection('teachers').findOne({ t_name: username });

    if (!teacher) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

    const match = await bcrypt.compare(password, teacher.t_password);
    if (!match) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

    const token = jwt.sign({ teacher_id: teacher.teacher_id, username, role: 'teacher' }, JWT_SECRET);
    res.json({ token });
  });

  // 📄 Lấy danh sách câu hỏi
  app.get('/questions', async (req, res) => {
    const questions = await db.collection('questions').find().toArray();
    res.json(questions);
  });

  // 📥 Nộp bài của học sinh (lưu vào "results")
  app.post('/submit', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { question_id, code, session_id } = req.body;
    const student_id = decoded.student_id;

    if (!question_id || !code || !session_id) return res.status(400).json({ error: 'Thiếu dữ liệu' });

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

  // ✅ Tổng kết khi học sinh bấm "Xong" (tùy chọn)
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

  // 👩‍🏫 API dành cho giáo viên: danh sách học sinh
  app.get('/students', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const students = await db.collection('students').find().toArray();
    res.json(students);
  });

  // 👩‍🏫 API dành cho giáo viên: lấy kết quả bài làm (collection "results")
  app.get('/results', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const results = await db.collection('results').find().toArray();
    res.json(results);
  });

  // 👩‍🏫 API tổng hợp kết quả theo học sinh
  app.get('/result-summary', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const pipeline = [
      {
        $group: {
          _id: "$student_id",
          answers: {
            $push: {
              question_id: "$question_id",
              correct: "$correct"
            }
          },
          correctCount: { $sum: { $cond: ["$correct", 1, 0] } },
          wrongCount: { $sum: { $cond: ["$correct", 0, 1] } }
        }
      }
    ];

    const summary = await db.collection('results').aggregate(pipeline).toArray();
    res.json(summary);
  });

  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
  });
}

main();
