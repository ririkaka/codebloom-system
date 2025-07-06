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

// Middleware kiểm tra JWT (sinh viên)
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.student_id = decoded.student_id;
    req.role = decoded.role || 'student';
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token không hợp lệ" });
  }
}

// Middleware dành riêng cho giáo viên
function verifyTeacher(req, res, next) {
  verifyToken(req, res, () => {
    if (req.role !== 'teacher') {
      return res.status(403).json({ error: "Bạn không có quyền truy cập" });
    }
    next();
  });
}

// Đăng nhập sinh viên
app.post('/login', async (req, res) => {
  const { student_id, password } = req.body;

  const student = await db.collection('students').findOne({ student_id });
  if (!student) return res.status(404).json({ error: "Sai mã sinh viên" });

  const isMatch = await bcrypt.compare(password, student.password);
  if (!isMatch) return res.status(401).json({ error: "Sai mật khẩu" });

  const token = jwt.sign({ student_id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ message: "Đăng nhập thành công!", token });
});

// API lấy danh sách câu hỏi
app.get('/questions', async (req, res) => {
  try {
    const questions = await db.collection('questions').find({}).toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn câu hỏi!" });
  }
});

// Nộp bài
app.post('/submit', verifyToken, async (req, res) => {
  try {
    const { question_id, code } = req.body;
    const student_id = req.student_id;

    const existing = await db.collection('results').findOne({ student_id, question_id });
    if (existing) {
      return res.status(400).json({ error: "Câu hỏi này đã được nộp trước đó" });
    }

    const question = await db.collection('questions').findOne({ question_id });
    if (!question) return res.status(404).json({ error: "Không tìm thấy câu hỏi" });

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

    res.json({ result: isCorrect ? "✅ Chính xác" : "❌ Sai rồi" });

  } catch (err) {
    console.error("❌ Lỗi khi chấm bài:", err.response?.data || err.message);
    res.status(500).json({ error: "Lỗi khi chấm bài" });
  }
});

// Xuất tổng kết cho giáo viên
app.get('/admin/summary', verifyTeacher, async (req, res) => {
  try {
    const allQuestions = await db.collection('questions').find({}, { projection: { question_id: 1, _id: 0 } }).toArray();
    const questionIds = allQuestions.map(q => q.question_id);

    const rawResults = await db.collection('results').aggregate([
      {
        $group: {
          _id: { student_id: "$student_id", question_id: "$question_id" },
          result: { $last: "$result" }
        }
      }
    ]).toArray();

    const studentMap = {};

    rawResults.forEach(entry => {
      const { student_id, question_id } = entry._id;
      const result = entry.result;

      if (!studentMap[student_id]) {
        studentMap[student_id] = {
          student_id,
          answers: {},
          correct: 0,
          wrong: 0
        };
      }

      studentMap[student_id].answers[question_id] = result;
      if (result === "Đúng") studentMap[student_id].correct++;
      else studentMap[student_id].wrong++;
    });

    const summary = Object.values(studentMap).map(student => {
      const row = {
        student_id: student.student_id,
        correct: student.correct,
        wrong: student.wrong
      };
      questionIds.forEach(qid => {
        row[qid] = student.answers[qid] || "—";
      });
      return row;
    });

    res.json({ questions: questionIds, results: summary });

  } catch (err) {
    console.error("❌ Lỗi xuất tổng hợp:", err);
    res.status(500).json({ error: "Không thể tạo báo cáo tổng hợp" });
  }
});
