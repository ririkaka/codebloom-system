require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Serve file tĩnh trong thư mục "public" (chứa teacher-login.html)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Kết nối MongoDB Atlas
const client = new MongoClient(process.env.MONGODB_URI);
let teachersCollection;

client.connect().then(async () => {
  const db = client.db('codebloom');
  teachersCollection = db.collection('teachers');
  console.log('✅ Kết nối thành công đến MongoDB');

  // 🧾 Kiểm tra dữ liệu giáo viên
  const list = await teachersCollection.find({}).toArray();
  console.log('📋 Danh sách giáo viên:', list);
}).catch(err => {
  console.error('❌ Không thể kết nối MongoDB:', err.message);
});

// ✅ API đăng nhập giáo viên
app.post('/api/teacher-login', async (req, res) => {
  const { teacher_id, t_password } = req.body;

  if (!teacher_id || !t_password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
  }

  try {
    const teacher = await teachersCollection.findOne({ teacher_id });

    if (!teacher) {
      return res.status(401).json({ message: 'Sai mã giáo viên hoặc mật khẩu' });
    }

    const isMatch = await bcrypt.compare(t_password, teacher.t_password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Sai mã giáo viên hoặc mật khẩu' });
    }

    // ✅ Tạo JWT token
    const token = jwt.sign(
      {
        teacher_id: teacher.teacher_id,
        t_name: teacher.t_name
      },
      process.env.JWT_SECRET || 'default_secret_key',
      { expiresIn: '1h' }
    );

    return res.json({ message: 'Đăng nhập thành công', token });
  } catch (err) {
    console.error('❌ Lỗi server khi đăng nhập:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ, vui lòng thử lại' });
  }
});

// ✅ Bảo vệ truy cập admin.html (nếu muốn dùng middleware sau này)
// app.get('/admin.html', verifyToken, (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'admin.html'));
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
