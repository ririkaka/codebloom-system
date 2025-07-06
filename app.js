require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ Phục vụ các file tĩnh như HTML, CSS, JS từ thư mục 'public'
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let db;

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

// ✅ Hàm xác thực token sinh viên và giáo viên
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
  db = client.db(); // sử dụng database mặc định

  // 👉 API: Đăng nhập sinh viên
  app.post('/login', async (req, res) => {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'Thiếu student_id' });

    const token = jwt.sign({ student_id, role: 'student' }, JWT_SECRET);
    res.json({ token });
  });

  // 👉 API: Đăng nhập giáo viên
  app.post('/login', async (req, res) => {
    const { teacher_id } = req.body;
    if (!teacher_id) return res.status(400).json({ error: 'Thiếu teacher_id' });

    const token = jwt.sign({ teacher_id, role: 'teacher' }, JWT_SECRET);
    res.json({ token });
  });

  // 👉 API: Lấy danh sách câu hỏi
  app.get('/questions', async (req, res) => {
    const questions = await db.collection('questions').find().toArray();
    res.json(questions);
  });

  // 👉 API: Nộp bài (lưu vào collection "results")
  app.post('/submit', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || decoded.role !== 'student') return res.status(401).json({ error: 'Unauthorized' });

    const { question_id, code, session_id } = req.body;
    const student_id = decoded.student_id;
    if (!question_id || !code || !session_id) {
      return res.status(400).json({ error: 'Thiếu dữ liệu' });
    }

    // 👉 Chấm điểm đơn giản: đúng nếu có từ "print"
    const correct = code.includes("print");

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

  // 👉 API: Lưu tổng kết (không bắt buộc nếu dùng "results")
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

  // 👉 API: Danh sách sinh viên (cho giáo viên)
  app.get('/students', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const students = await db.collection('students').find().toArray();
    res.json(students);
  });

  // 👉 API: Kết quả chi tiết đã nộp
  app.get('/results', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const results = await db.collection('results').find().toArray();
    res.json(results);
  });

  // 👉 API: Tổng hợp kết quả từ collection "results"
  app.get('/result-summary', async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!verifyTeacherToken(token)) return res.status(401).json({ error: 'Unauthorized' });

    const cursor = await db.collection('results').aggregate([
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
    ]).toArray();

    res.json(cursor);
  });

  // 👉 Nếu truy cập "/", trả về file role-select.html
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'role-select.html'));
  });

  app.listen(PORT, () => {
    console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  });
}

main().catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));
