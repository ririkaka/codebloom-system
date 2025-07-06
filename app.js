require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let db;

// Middleware xác thực JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Thiếu token' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Token không hợp lệ' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token sai hoặc hết hạn' });
    req.user = decoded;
    next();
  });
}

// Kết nối MongoDB
async function connectToDB() {
  await client.connect();
  db = client.db('codebloom');
  console.log('✅ Đã kết nối MongoDB');
}
connectToDB();

// 🔹 API: Lấy danh sách câu hỏi
app.get('/questions', async (req, res) => {
  try {
    const questions = await db.collection('questions').find().toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lấy danh sách câu hỏi' });
  }
});

// 🔹 API: Nộp bài - Lưu kết quả vào `results`
app.post('/results', verifyToken, async (req, res) => {
  const { question_id, code, session_id } = req.body;
  const student_id = req.user.student_id;

  if (!question_id || !code || !session_id) {
    return res.status(400).json({ error: 'Thiếu thông tin nộp bài' });
  }

  try {
    const question = await db.collection('questions').findOne({ question_id });
    if (!question) return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });

    // ⚙️ Chấm tự động (ví dụ đơn giản, bạn có thể dùng sandbox hoặc hệ thống chấm nâng cao)
    const isCorrect = question.expected_output && code.includes(question.expected_output);
    const result = isCorrect ? `✅ Đúng (${question.expected_output})` : `❌ Sai`;

    const results = {
      student_id,
      session_id,
      question_id,
      code,
      result,
      submitted_at: new Date()
    };

    await db.collection('results').insertOne(results);
    res.json({ message: 'Đã lưu kết quả', result });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi nộp bài' });
  }
});

// 🔹 API: Gửi kết quả tổng kết phiên làm bài
app.post('/summary', verifyToken, async (req, res) => {
  const { correct, incorrect, total, session_id, submitted_at } = req.body;
  const student_id = req.user.student_id;

  if (!session_id) return res.status(400).json({ error: 'Thiếu session_id' });

  const summary = {
    student_id,
    session_id,
    correct,
    incorrect,
    total,
    submitted_at: submitted_at ? new Date(submitted_at) : new Date()
  };

  try {
    await db.collection('summaries').insertOne(summary);
    res.json({ message: 'Đã lưu tổng kết' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lưu tổng kết' });
  }
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
