const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const fs = require('fs');

async function importTeachers() {
    const uri = "mongodb+srv://CamTu123:CamTu123@cluster0ctu.0fxpqmu.mongodb.net/codebloom"; 
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('codebloom');
        const collection = db.collection('teachers');

        console.log("🧹 Đang xóa dữ liệu giáo viên cũ...");
        await collection.deleteMany({});

        if (!fs.existsSync('teachers.json')) {
            console.error("❌ Không tìm thấy file teachers.json!");
            return;
        }

        const rawData = JSON.parse(fs.readFileSync('teachers.json', 'utf8'));
        console.log(`--- Đang xử lý ${rawData.length} giáo viên... ---`);

        const saltRounds = 12; // Khớp với hình ảnh DB của bạn ($2b$12)
        
        const hashedData = await Promise.all(rawData.map(async (t) => {
            // KIỂM TRA LỖI: Lấy mật khẩu từ t_password hoặc password hoặc pass
            const plainPassword = t.t_password || t.password || t.pass;

            if (typeof plainPassword !== 'string') {
                throw new Error(`Giáo viên ID ${t.teacher_id} bị thiếu mật khẩu hoặc mật khẩu không phải dạng text.`);
            }

            const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
            
            return {
                teacher_id: t.teacher_id,
                t_name: t.t_name || t.name, // Lấy t_name, nếu không có thì lấy name
                t_password: hashedPassword
            };
        }));

        const result = await collection.insertMany(hashedData);
        console.log("-----------------------------------------");
        console.log(`🎉 THÀNH CÔNG: Đã thêm ${result.insertedCount} giáo viên.`);
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("❌ Lỗi trong quá trình thực thi:", error.message);
    } finally {
        await client.close();
        console.log("🔌 Đã đóng kết nối.");
    }
}

importTeachers();