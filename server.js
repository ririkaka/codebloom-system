const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 📁 Serve file HTML (QUAN TRỌNG)
app.use(express.static('public'));

// 🔗 Kết nối MongoDB Atlas
mongoose.connect("mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom?retryWrites=true&w=majority")
  .then(() => console.log("✅ Kết nối MongoDB thành công"))
  .catch(err => console.error("❌ Lỗi MongoDB:", err));

// 📌 Test route
app.get('/api/test', (req, res) => {
  res.json({ message: "Server hoạt động OK!" });
});

// 📌 Route mặc định (tránh lỗi Cannot GET /)
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/ping', (req, res) => {
  res.status(200).send("pong");
});

// 🚀 PORT cho Render
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});