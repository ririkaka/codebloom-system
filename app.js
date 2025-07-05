require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // dùng bcryptjs để tránh lỗi build trên Render
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // để phục vụ các file HTML frontend

// Kết nối MongoDB
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

// Middleware xác thực JWT
function verifyToken(req, res, next) {
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

// Route: Đăng nhập
app.post('/login', async (req, res) => {
  const { student_id, password } = req.body;

  const student = await db.collection('students').findOne({ student_id });
  if (!student) return res.status(404).json({ error: "Sai mã sinh viên" });

  const isMatch = await bcrypt.compare(password, student.password);
  if (!isMatch) return res.status(401).json({ error: "Sai mật khẩu" });

  const token = jwt.sign({ student_id }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: "Đăng nhập thành công!", token });
});

// Route: Lấy danh sách câu hỏi
app.get('/questions', async (req, res) => {
  try {
    const questions = await db.collection('questions').find({}).toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn câu hỏi!" });
  }
});

// Route: Nộp bài, chấm điểm
app.post('/submit', verifyToken, async (req, res) => {
  try {
    const { question_id, code } = req.body;
    const student_id = req.student_id;

    const question = await db.collection('questions').findOne({ question_id });
    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

    const judge0Res = await axios.post("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true", {
      language_id: 71, // C++ (GCC)
      source_code: code,
      stdin: question.test_input
    }, {
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
      }
    });

    const actual_output = judge0Res.data.stdout?.trim() || "";
    const expected_output = question.expected_output?.trim() || "";
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

    res.json({
      result: isCorrect ? "✅ Chính xác" : "❌ Sai rồi",
      actual_output,
      expected_output
    });

  } catch (err) {
    console.error("❌ Lỗi khi chấm bài:", err.response?.data || err.message);
    res.status(500).json({ error: "Lỗi khi chấm bài" });
  }
});
// API lấy danh sách câu hỏi đã làm
app.get('/submitted-questions', verifyToken, async (req, res) => {
  try {
    const student_id = req.student_id;
    const submissions = await db.collection('results')
      .find({ student_id })
      .project({ question_id: 1 })
      .toArray();

    const submittedIds = submissions.map(item => item.question_id);
    res.json({ submitted: submittedIds });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách câu hỏi đã làm" });
  }
});
