const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const fs = require('fs');

async function importStudents() {
    // 1. Cấu hình kết nối (Thay đổi URI phù hợp với Atlas của bạn)
    const uri = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom"; 
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("🚀 Đã kết nối tới MongoDB thành công!");

        const db = client.db('codebloom');
        const collection = db.collection('students');

        // 2. Đọc dữ liệu từ file students.json
        const rawData = JSON.parse(fs.readFileSync('students.json', 'utf8'));
        
        console.log(`--- Đang xử lý băm mật khẩu cho ${rawData.length} học sinh... ---`);

        // 3. Mã hóa mật khẩu giống định dạng trong hình ($2b$10...)
        const saltRounds = 10;
        const hashedData = await Promise.all(rawData.map(async (student) => {
            const hashedPassword = await bcrypt.hash(student.password, saltRounds);
            return {
                ...student,
                password: hashedPassword // Ghi đè mật khẩu thô bằng mật khẩu đã băm
            };
        }));

        // 4. (Tùy chọn) Xóa dữ liệu cũ để tránh trùng ID nếu bạn muốn làm sạch DB trước
        // await collection.deleteMany({});

        // 5. Chèn dữ liệu vào MongoDB
        const result = await collection.insertMany(hashedData);
        
        console.log("-----------------------------------------");
        console.log(`✅ Thành công! Đã thêm ${result.insertedCount} học sinh.`);
        console.log("🔒 Tất cả mật khẩu đã được mã hóa Bcrypt.");
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("❌ Lỗi trong quá trình import:", error);
    } finally {
        await client.close();
    }
}

importStudents();