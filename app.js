// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
let db;

client.connect()
  .then(() => {
    db = client.db("codebloom");
    console.log("✅ Đã kết nối MongoDB!");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:", err);
  });

// Middleware kiểm tra JWT sinh viên
function verifyStudent(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.student_id = decoded.student_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}

// Middleware kiểm tra JWT giáo viên
function verifyTeacher(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.teacher_id = decoded.teacher_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}

// Đăng nhập sinh viên
app.post('/login', async (req, res) => {
  const { student_id, password } = req.body;
  const student = await db.collection('students').findOne({ student_id });
  if (!student) return res.status(404).json({ error: "Sai mã sinh viên" });

  const isMatch = await bcrypt.compare(password, student.password);
  if (!isMatch) return res.status(401).json({ error: "Sai mật khẩu" });

  const token = jwt.sign({ student_id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: "Đăng nhập thành công!", token });
});

// Đăng nhập giáo viên
app.post('/teacher-login', async (req, res) => {
  const { teacher_id, password } = req.body;
  const teacher = await db.collection('teachers').findOne({ teacher_id });
  if (!teacher) return res.status(404).json({ error: "Sai mã giáo viên" });

  const isMatch = await bcrypt.compare(password, teacher.password);
  if (!isMatch) return res.status(401).json({ error: "Sai mật khẩu" });

  const token = jwt.sign({ teacher_id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: "Đăng nhập thành công!", token });
});

// Lấy danh sách câu hỏi
app.get('/questions', async (req, res) => {
  try {
    const questions = await db.collection('questions').find({}).toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn câu hỏi!" });
  }
});

// Nộp bài làm (sinh viên)
app.post('/submit', verifyStudent, async (req, res) => {
  try {
    const { question_id, code } = req.body;
    const student_id = req.student_id;

    const question = await db.collection('questions').findOne({ question_id });
    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

    const existing = await db.collection('results').findOne({ student_id, question_id });
    if (existing) return res.status(400).json({ error: "Bạn đã nộp bài cho câu hỏi này" });

    const judge0Res = await axios.post("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true", {
      language_id: 71,
      source_code: code,
      stdin: question.test_input
    }, {
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
      }
    });

    const actual_output = judge0Res.data.stdout?.trim();
    const expected_output = question.expected_output?.trim();
    const isCorrect = actual_output === expected_output;

    await db.collection('results').insertOne({
      student_id,
      question_id,
      code,
      result: isCorrect ? "Đúng" : "Sai",
      actual_output,
      expected_output,
      submitted_at: new Date()
    });

    res.json({ result: "Đã nộp bài!" });

  } catch (err) {
    console.error("❌ Lỗi khi chấm bài:", err.response?.data || err.message);
    res.status(500).json({ error: "Lỗi khi chấm bài" });
  }
});

// Xem bảng kết quả tổng hợp (admin)
app.get('/admin/results', verifyTeacher, async (req, res) => {
  try {
    const results = await db.collection('results').find({}).toArray();
    const allData = {};

    results.forEach(r => {
      if (!allData[r.student_id]) {
        allData[r.student_id] = { student_id: r.student_id, correct: 0, incorrect: 0, details: {} };
      }
      allData[r.student_id].details[r.question_id] = r.result;
      if (r.result === "Đúng") allData[r.student_id].correct++;
      else allData[r.student_id].incorrect++;
    });

    const output = Object.values(allData);
    res.json(output);

  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy kết quả" });
  }
});
