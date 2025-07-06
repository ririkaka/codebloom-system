// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Phục vụ file HTML/CSS/JS từ thư mục "public"
app.use(express.static(path.join(__dirname, 'public')));

const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;
const client = new MongoClient(mongoUri);

// Middleware xác thực JWT
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

// Kết nối MongoDB và khai báo collection
client.connect().then(() => {
  const db = client.db();
  const students = db.collection('students');
  const teachers = db.collection('teachers');
  const questions = db.collection('questions');
  const results = db.collection('results');

  // 🔐 Đăng nhập học sinh
  app.post('/login', async (req, res) => {
    const { student_id, password } = req.body;
    const student = await students.findOne({ student_id });

    if (!student || !(await bcrypt.compare(password, student.password))) {
      return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
    }

    const token = jwt.sign({ student_id }, jwtSecret);
    res.json({ token });
  });

  // 🔐 Đăng nhập giáo viên
  app.post('/teacher-login', async (req, res) => {
    const { teacher_id, password } = req.body;
    const teacher = await teachers.findOne({ teacher_id });

    if (!teacher || !(await bcrypt.compare(password, teacher.t_password))) {
      return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
    }

    const token = jwt.sign({ teacher_id }, jwtSecret);
    res.json({ token });
  });

  // 📚 Lấy danh sách câu hỏi
  app.get('/questions', async (req, res) => {
    const list = await questions.find().toArray();
    res.json(list);
  });

  // 📤 Nộp bài
  app.post('/submit', verifyToken, async (req, res) => {
    const { student_id } = req.user;
    const { question_id, code, session_id } = req.body;

    if (!question_id || !session_id) {
      return res.status(400).json({ error: 'Thiếu thông tin câu hỏi hoặc phiên làm bài' });
    }

    // Không cho nộp lại trong cùng phiên
    const existing = await results.findOne({ student_id, question_id, session_id });
    if (existing) {
      return res.status(400).json({ error: 'Bạn đã nộp câu này trong phiên này rồi!' });
    }

    // Tạm chấm bài: nếu có "print" thì đúng
    const correct = code.includes("print");

    await results.insertOne({
      student_id,
      question_id,
      session_id,
      code,
      correct,
      submittedAt: new Date()
    });

    res.json({
      result: correct ? '✅ Đúng' : '❌ Sai',
      actual_output: '...',
      expected_output: '...'
    });
  });

  // 📊 Xem kết quả tổng hợp cho giáo viên
  app.get('/result-summary', verifyToken, async (req, res) => {
    const allSubs = await results.aggregate([
      {
        $group: {
          _id: { student_id: "$student_id", question_id: "$question_id", session_id: "$session_id" },
          correct: { $first: "$correct" }
        }
      },
      {
        $group: {
          _id: { student_id: "$_id.student_id", session_id: "$_id.session_id" },
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

    // Thêm tên học sinh từ bảng students
    const withNames = await Promise.all(
      allSubs.map(async item => {
        const student = await students.findOne({ student_id: item._id.student_id });
        return {
          student_id: item._id.student_id,
          session_id: item._id.session_id,
          name: student?.name || '',
          answers: item.answers,
          correctCount: item.correctCount,
          wrongCount: item.wrongCount
        };
      })
    );

    res.json(withNames);
  });

  // 🟢 Khởi động server
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  });
});
