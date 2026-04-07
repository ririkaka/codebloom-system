const fs = require('fs');
const bcrypt = require('bcrypt');

try {
  const teachers = JSON.parse(fs.readFileSync('teachers.json', 'utf-8'));

  (async () => {
    for (let teacher of teachers) {
      teacher.password = await bcrypt.hash(teacher.password || "123", 10);
    }

    fs.writeFileSync('teachers_hashed.json', JSON.stringify(teachers, null, 2));
    console.log("✅ Đã tạo teachers_hashed.json");
  })();

} catch (err) {
  console.error("❌ Lỗi:", err);
}