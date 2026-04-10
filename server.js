const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// =======================
// 🛠 Middleware
// =======================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =======================
// 🔗 Kết nối MongoDB
// =======================
// Đã thay thế chuỗi kết nối trực tiếp của bạn vào đây
const mongoURI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Kết nối MongoDB Atlas thành công!"))
  .catch(err => {
    console.error("❌ Lỗi kết nối MongoDB:");
    console.error("- Thông báo lỗi:", err.message);
    console.error("- Hướng dẫn: Kiểm tra lại Network Access (IP Whitelist) trên MongoDB Atlas.");
    // Không đóng process ngay để bạn có thể đọc được log lỗi
  });

// =======================
// 📦 Model Result
// =======================
const resultSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  answers: { type: Array, default: [] },
  correctCount: { type: Number, default: 0 },
  wrongCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Result = mongoose.model('Result', resultSchema);

// =======================
// 📌 API Routes
// =======================

// 1. Kiểm tra trạng thái server
app.get('/api/test', (req, res) => {
  res.json({ 
    status: "OK",
    message: "Server CodeBloom đang chạy trên MongoDB Atlas",
    timestamp: new Date()
  });
});

// 2. API nộp bài
app.post('/api/submit', async (req, res) => {
  try {
    const { studentId, answers, correctCount, wrongCount } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: "Thiếu studentId" });
    }

    const result = new Result({
      studentId,
      answers,
      correctCount,
      wrongCount
    });

    await result.save();
    console.log(`📝 Đã lưu kết quả thành công cho: ${studentId}`);
    
    res.status(201).json({ message: "✅ Lưu kết quả thành công" });
  } catch (err) {
    console.error("Lỗi nộp bài:", err);
    res.status(500).json({ error: "Lỗi hệ thống khi lưu bài làm" });
  }
});

// 3. API lấy danh sách kết quả (Lấy lần cuối của mỗi học sinh)
app.get('/api/results', async (req, res) => {
  try {
    const results = await Result.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$studentId",
          latestResult: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$latestResult" } }
    ]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Không thể lấy dữ liệu kết quả" });
  }
});

// =======================
// 📌 Route mặc định
// =======================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =======================
// 🚀 Khởi chạy Server
// =======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  -----------------------------------------
  🚀 SERVER CODEBLOOM ĐÃ SẴN SÀNG
  📡 Cổng: ${PORT}
  🔗 Local: http://localhost:${PORT}
  -----------------------------------------
  `);
});