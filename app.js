// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;
const client = new MongoClient(mongoUri);

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

client.connect().then(() => {
  const db = client.db();
  const students = db.collection('students');
  const teachers = db.collection('teachers');
  const questions = db.collection('questions');
  const submissions = db.collection('submissions');

  app.post('/login', async (req, res) => {
    const { student_id, password } = req.body;
    const student = await students.findOne({ student_id });

    if (!student || !(await bcrypt.compare(password, student.password))) {
      return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
    }

    const token = jwt.sign({ student_id }, jwtSecret);
    res.json({ token });
  });

  app.post('/teacher-login', async (req, res) => {
    const { teacher_id, password } = req.body;
    const teacher = await teachers.findOne({ teacher_id });

    if (!teacher || !(await bcrypt.compare(password, teacher.t_password))) {
      return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
    }

    const token = jwt.sign({ teacher_id }, jwtSecret);
    res.json({ token });
  });

  app.get('/questions', async (req, res) => {
    const list = await questions.find().toArray();
    res.json(list);
  });

  app.post('/submit', verifyToken, async (req, res) => {
    const { student_id } = req.user;
    const { question_id, code, session_id } = req.body;

    if (!session_id) return res.status(400).json({ error: 'Thiếu mã phiên làm bài' });

    const existing = await submissions.findOne({ student_id, question_id, session_id });

    if (existing) {
      return res.status(400).json({ error: 'Bạn đã nộp câu này trong phiên này rồi!' });
    }

    // Chấm bài tạm thời: code chứa từ "print" là đúng
    const correct = code.includes("print");

    await submissions.insertOne({
      student_id,
      question_id,
      code,
      session_id,
      correct,
      submittedAt: new Date()
    });

    res.json({ result: correct ? 'Đúng' : 'Sai', actual_output: '...', expected_output: '...' });
  });

  app.get('/result-summary', verifyToken, async (req, res) => {
    const allSubs = await submissions.aggregate([
      {
        $group: {
          _id: { student_id: "$student_id", question_id: "$question_id" },
          correct: { $first: "$correct" },
        }
      },
      {
        $group: {
          _id: "$_id.student_id",
          answers: {
            $push: {
              question_id: "$_id.question_id",
              correct: "$correct"
            }
          },
          correctCount: {
            $sum: { $cond: ["$correct", 1, 0] }
          },
          wrongCount: {
            $sum: { $cond: ["$correct", 0, 1] }
          }
        }
      }
    ]).toArray();

    res.json(allSubs);
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
  });
});
