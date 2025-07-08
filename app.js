
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
let db;
client.connect().then(() => {
  db = client.db();
  console.log("✅ Kết nối MongoDB thành công");
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/ping', (req, res) => {
  res.send('pong');
});

function verifyToken(req, res, next) {
  const bearerHeader = req.headers['authorization'];
  if (!bearerHeader) return res.status(403).json({ message: 'Thiếu token' });
  const token = bearerHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token không hợp lệ' });
    req.teacher = decoded;
    next();
  });
}

app.post('/teacher-login', async (req, res) => {
  const { teacher_id, t_password } = req.body;
  try {
    const teacher = await db.collection('teachers').findOne({ teacher_id });
    if (!teacher) return res.status(401).json({ message: 'Sai mã giáo viên' });
    const valid = await bcrypt.compare(t_password, teacher.t_password);
    if (!valid) return res.status(401).json({ message: 'Sai mật khẩu' });
    const token = jwt.sign({ teacher_id: teacher.teacher_id }, process.env.JWT_SECRET, { expiresIn: '6h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server đang chạy tại http://localhost:" + PORT);
});
