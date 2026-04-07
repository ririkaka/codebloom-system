const fs = require('fs');
const bcrypt = require('bcrypt');

try {
  const students = JSON.parse(fs.readFileSync('students.json', 'utf-8'));

  (async () => {
    for (let student of students) {
      student.password = await bcrypt.hash(student.password || "123", 10);
    }

    fs.writeFileSync('students_hashed.json', JSON.stringify(students, null, 2));
    console.log("✅ Đã tạo students_hashed.json");
  })();

} catch (err) {
  console.error("❌ Lỗi:", err);
}