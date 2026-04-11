const { MongoClient } = require('mongodb');
const fs = require('fs');

async function importResults() {
    // 1. Cấu hình kết nối (Thay thông tin Atlas của bạn vào đây)
    const uri = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom"; 
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("🚀 Kết nối MongoDB thành công!");

        const db = client.db('codebloom');
        const collection = db.collection('results');

        // 2. Kiểm tra file results.json có tồn tại không
        if (!fs.existsSync('results.json')) {
            console.error("❌ Lỗi: Không tìm thấy file 'results.json'. Hãy chạy script tạo dữ liệu trước!");
            return;
        }

        // 3. Đọc dữ liệu từ file
        const data = JSON.parse(fs.readFileSync('results.json', 'utf8'));
        console.log(`📊 Đã đọc ${data.length} bản ghi từ file JSON.`);

        // 4. Xóa dữ liệu cũ để làm sạch collection
        console.log("🧹 Đang dọn dẹp dữ liệu cũ trong collection 'results'...");
        await collection.deleteMany({});

        // 5. Chèn dữ liệu mới
        // Với số lượng > 1000 bản ghi, insertMany vẫn hoạt động rất tốt
        console.log("📥 Đang import dữ liệu vào MongoDB...");
        const result = await collection.insertMany(data);

        console.log("-----------------------------------------");
        console.log(`✅ THÀNH CÔNG!`);
        console.log(`📦 Tổng số bản ghi đã chèn: ${result.insertedCount}`);
        console.log(`📂 Collection: results`);
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("❌ Lỗi trong quá trình import:", error);
    } finally {
        await client.close();
        console.log("🔌 Đã đóng kết nối.");
    }
}

importResults();