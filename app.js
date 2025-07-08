require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET || "secret";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new MongoClient(mongoUri);
let db;

client.connect()
  .then(() => {
    db = client.db();
    console.log("✅ Kết nối thành công đến MongoDB");
  })
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:", err);
  });

// Middleware xác thực JWT
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Không có token' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Token không hợp lệ' });
    req.user = decoded;
    next();
  });
}

// Đăng nhập giáo viên
app.post('/teacher-login', async (req, res) => {
  const { teacher_id, password } = req.body;
  const teacher = await db.collection('teachers').findOne({ teacher_id });
  if (!teacher || !await bcrypt.compare(password, teacher.t_password)) {
    return res.status(401).json({ message: 'Sai thông tin đăng nhập' });
  }
  const token = jwt.sign({ teacher_id }, jwtSecret, { expiresIn: '2h' });
  res.json({ token });
});

// Đăng nhập sinh viên
app.post('/student-login', async (req, res) => {
  const { student_id, password } = req.body;
  const student = await db.collection('students').findOne({ student_id });
  if (!student || !await bcrypt.compare(password, student.password)) {
    return res.status(401).json({ message: 'Sai mã sinh viên hoặc mật khẩu' });
  }
  const token = jwt.sign({ student_id }, jwtSecret, { expiresIn: '2h' });
  res.json({ token });
});

// API: Lấy danh sách sinh viên
app.get('/students', verifyToken, async (req, res) => {
  try {
    const students = await db.collection('students').find().toArray();
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Lỗi tải danh sách sinh viên" });
  }
});

// API: Lấy tất cả kết quả
app.get('/results', verifyToken, async (req, res) => {
  try {
    const results = await db.collection('results').find().toArray();
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Lỗi tải kết quả" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
