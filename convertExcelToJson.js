const xlsx = require('xlsx');
const fs = require('fs');

// Đọc file Excel
const workbook1 = xlsx.readFile('students.xlsx');
const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];

const workbook2 = xlsx.readFile('teachers.xlsx');
const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];

// Chuyển sang JSON
const students = xlsx.utils.sheet_to_json(sheet1);
const teachers = xlsx.utils.sheet_to_json(sheet2);

// Ghi ra file JSON
fs.writeFileSync('students.json', JSON.stringify(students, null, 2), 'utf-8');
fs.writeFileSync('teachers.json', JSON.stringify(teachers, null, 2), 'utf-8');

console.log("✅ Đã tạo students.json");
console.log("✅ Đã tạo teachers.json");