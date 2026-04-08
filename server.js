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
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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

// 🚀 PORT cho Render
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});