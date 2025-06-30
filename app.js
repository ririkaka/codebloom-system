// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require("path");
app.use(express.static(path.join(__dirname, 'public')));
const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'super_secret_key_cua_co_Tu'; // Cô có thể thay đổi nếu muốn bảo mật hơn

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri, { useUnifiedTopology: true });

let db;

client.connect()
  .then(() => {
    db = client.db("codebloom");
    console.log("✅ Đã kết nối MongoDB!");

    app.listen(3000, () => {
      console.log("🚀 Server chạy tại http://localhost:3000");
    });
  })
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:", err);
  });

// 🔐 API đăng nhập
app.post('/login', async (req, res) => {
  try {
    const { student_id, password } = req.body;
    console.log("📥 Đăng nhập:", student_id);

    const user = await db.collection('students').findOne({ student_id });

    if (!user) {
      return res.status(401).json({ error: "Sai student_id" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Sai mật khẩu" });
    }

    const token = jwt.sign({ student_id }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });

  } catch (err) {
    console.error("❌ Lỗi login:", err.message || err);
    res.status(500).json({ error: "Lỗi hệ thống khi đăng nhập" });
  }
});

// 📋 API lấy danh sách câu hỏi
app.get('/questions', async (req, res) => {
  try {
    const questions = await db.collection('questions').find({}).toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn câu hỏi!" });
  }
});

// 🧠 API nộp bài và chấm
app.post('/submit', async (req, res) => {
  try {
    const { question_id, code, student_id } = req.body;

    const question = await db.collection('questions').findOne({ question_id });
    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

    const judge0Res = await axios.post("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true", {
      language_id: 71, // Python 3
      source_code: code,
      stdin: question.test_input
    }, {
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
      }
    });

    console.log("📩 Judge0:", judge0Res.data);

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

    res.json({
      result: isCorrect ? "✅ Chính xác" : "❌ Sai rồi",
      actual_output,
      expected_output
    });

  } catch (err) {
    console.error("❌ Lỗi khi gọi Judge0:", err.response?.data || err.message);
    res.status(500).json({ error: "Lỗi khi chấm bài" });
  }
});
