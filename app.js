require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // để phục vụ các file HTML nếu cần

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
let db;

// Kết nối MongoDB
client.connect()
  .then(() => {
    db = client.db("codebloom");
    console.log("✅ Đã kết nối MongoDB");

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:", err);
  });

// Middleware kiểm tra JWT sinh viên
function verifyStudentToken(req, res, next) {
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
function verifyTeacherToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Chưa đăng nhập giáo viên" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.teacher_id = decoded.teacher_id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token giáo viên không hợp lệ" });
  }
}

// ========== 1. Đăng nhập sinh viên ==========
app.post('/login', async (req, res) => {
  const { student_id, password } = req.body;

  const student = await db.collection('students').findOne({ student_id });
  if (!student) return res.status(404).json({ error: "Sai mã sinh viên" });

  const isMatch = await bcrypt.compare(password, student.password);
  if (!isMatch) return res.status(401).json({ error: "Sai mật khẩu" });

  const token = jwt.sign({ student_id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: "Đăng nhập thành công!", token });
});

// ========== 2. Đăng nhập giáo viên ==========
app.post('/teacher-login', async (req, res) => {
  const { teacher_id, password } = req.body;

  const teacher = await db.collection('teachers').findOne({ teacher_id });
  if (!teacher) return res.status(404).json({ error: "Sai mã giáo viên" });

  const isMatch = await bcrypt.compare(password, teacher.t_password);
  if (!isMatch) return res.status(401).json({ error: "Sai mật khẩu" });

  const token = jwt.sign({ teacher_id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: "Đăng nhập giáo viên thành công!", token });
});

// ========== 3. Lấy danh sách câu hỏi ==========
app.get('/questions', async (req, res) => {
  try {
    const questions = await db.collection('questions').find({}).toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn câu hỏi!" });
  }
});

// ========== 4. Chấm bài của sinh viên ==========
app.post('/submit', verifyStudentToken, async (req, res) => {
  try {
    const { question_id, code } = req.body;
    const student_id = req.student_id;

    // Kiểm tra câu hỏi
    const question = await db.collection('questions').findOne({ question_id });
    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

    // Kiểm tra nếu đã nộp bài rồi
    const existed = await db.collection('results').findOne({ student_id, question_id });
    if (existed) return res.status(400).json({ error: "Bạn đã nộp câu này rồi!" });

    // Gửi code lên Judge0
    const judge0Res = await axios.post("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true", {
      language_id: 71, // C++ (hoặc 63 cho JavaScript)
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

    // Lưu kết quả vào MongoDB
    await db.collection('results').insertOne({
      student_id,
      question_id,
      code,
      result: isCorrect ? "Đúng" : "Sai",
      actual_output,
      expected_output,
      submitted_at: new Date()
    });

    // Trả về kết quả nhưng không cho xem chi tiết (ẩn)
    res.json({
      result: isCorrect ? "Đã nộp ✅" : "Đã nộp ❌"
    });

  } catch (err) {
    console.error("❌ Lỗi khi chấm bài:", err.response?.data || err.message);
    res.status(500).json({ error: "Lỗi khi chấm bài" });
  }
});

// ========== 5. Kết quả tổng hợp cho giáo viên ==========
app.get('/admin-results', verifyTeacherToken, async (req, res) => {
  try {
    const students = await db.collection('students').find({}).toArray();
    const questions = await db.collection('questions').find({}).toArray();
    const results = await db.collection('results').find({}).toArray();

    const table = students.map(student => {
      const row = {
        student_id: student.student_id,
        details: {},
        correct: 0,
        wrong: 0
      };

      questions.forEach(q => {
        const r = results.find(r => r.student_id === student.student_id && r.question_id === q.question_id);
        row.details[q.question_id] = r ? r.result : "Chưa làm";

        if (r?.result === "Đúng") row.correct++;
        else if (r?.result === "Sai") row.wrong++;
      });

      return row;
    });

    res.json({ table, questions: questions.map(q => q.question_id) });
  } catch (err) {
    console.error("❌ Lỗi lấy kết quả tổng hợp:", err);
    res.status(500).json({ error: "Không thể lấy kết quả tổng hợp" });
  }
});
