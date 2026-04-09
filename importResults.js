const mongoose = require("mongoose");
const fs = require("fs");

// ====== 🔗 KẾT NỐI MONGODB ======
const MONGODB_URI = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom";


mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ Kết nối MongoDB thành công"))
  .catch(err => console.error("❌ Lỗi kết nối MongoDB:", err));

// ====== 📦 SCHEMA ======
const resultSchema = new mongoose.Schema({
  student_id: String,
  question_id: String,
  correct: Boolean,
  session_id: String
});

const Result = mongoose.model("Result", resultSchema);

// ====== 📥 IMPORT DATA ======
async function importData() {
  try {
    const data = JSON.parse(fs.readFileSync("results.json", "utf-8"));

    // ⚠️ Xóa dữ liệu cũ (nếu muốn)
    await Result.deleteMany();
    console.log("🗑️ Đã xóa dữ liệu cũ");

    // 🚀 Insert dữ liệu mới
    await Result.insertMany(data);
    console.log("🎉 Import dữ liệu thành công!");

    process.exit();
  } catch (error) {
    console.error("❌ Lỗi import:", error);
    process.exit(1);
  }
}

// ====== ▶️ CHẠY ======
importData();