require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 🟢 Serve file HTML trong thư mục /public
app.use(express.static('public'));

// MongoDB
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
let teachersCollection;

client.connect().then(() => {
  const db = client.db('your_db_name'); // thay bằng tên database thực tế
  teachersCollection = db.collection('teachers');
  console.log('✅ Kết nối MongoDB thành công');
}).catch(console.error);

// API login
app.post('/api/teacher-login', async (req, res) => {
  const { teacher_id, t_password } = req.body;

  try {
    const teacher = await teachersCollection.findOne({ teacher_id });
    if (!teacher) return res.status(401).json({ message: 'Sai mã giáo viên hoặc mật khẩu' });

    const isMatch = await bcrypt.compare(t_password, teacher.t_password);
    if (!isMatch) return res.status(401).json({ message: 'Sai mã giáo viên hoặc mật khẩu' });

    const token = jwt.sign(
      { teacher_id: teacher.teacher_id, t_name: teacher.t_name },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '1h' }
    );

    res.json({ message: 'Đăng nhập thành công', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
