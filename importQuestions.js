const mongoose = require('mongoose');
const fs = require('fs');

// 🔥 DÁN URI CỦA BẠN VÀO ĐÂY
const MONGODB_URI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom";

// Kết nối MongoDB
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("✅ Đã kết nối MongoDB");

    // Đọc file JSON
    const data = JSON.parse(fs.readFileSync('questions.json', 'utf-8'));

    // Tạo model tạm (không cần schema)
    const Question = mongoose.model("Question", new mongoose.Schema({}, { strict: false }));

    // Xóa dữ liệu cũ (nếu muốn)
    await Question.deleteMany({});
    console.log("🗑️ Đã xóa dữ liệu cũ");

    // Thêm dữ liệu mới
    await Question.insertMany(data);

    console.log("🎉 Import thành công!");

    process.exit();
  })
  .catch(err => {
    console.error("❌ Lỗi:", err);
  });