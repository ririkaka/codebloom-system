const fs = require('fs');

// 1. Khởi tạo danh sách 50 học sinh và 10 câu hỏi
const students = Array.from({ length: 50 }, (_, i) => (i + 1).toString().padStart(3, '0'));
const questions = Array.from({ length: 10 }, (_, i) => `Q${(i + 1).toString().padStart(3, '0')}`);
const results = [];

console.log("🛠️ Đang khởi tạo dữ liệu mẫu cho codebloom-system...");

// 2. Vòng lặp tạo dữ liệu
students.forEach(sId => {
    // Mỗi học sinh làm ngẫu nhiên từ 2 đến 4 phiên (trung bình 3 phiên)
    const numSessions = Math.floor(Math.random() * 3) + 2; 
    
    for (let i = 1; i <= numSessions; i++) {
        const sessionId = `PHIEN_${i}`;
        
        // Mỗi phiên làm ngẫu nhiên từ 7 đến 8 câu hỏi để tăng số lượng bản ghi
        // (50 SV * 3 phiên * 7.5 câu = 1125 bản ghi)
        const numQs = Math.floor(Math.random() * 2) + 7; 
        
        // Trộn ngẫu nhiên danh sách câu hỏi để chọn ra các câu khác nhau trong 1 phiên
        const shuffledQs = [...questions].sort(() => 0.5 - Math.random());
        const selectedQs = shuffledQs.slice(0, numQs);
        
        selectedQs.forEach(qId => {
            results.push({
                student_id: sId,
                question_id: qId,
                correct: Math.random() > 0.4, // Tỉ lệ làm đúng là 60%
                session_id: sessionId
            });
        });
    }
});

// 3. Xuất ra file JSON
try {
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
    console.log("-----------------------------------------");
    console.log(`✅ THÀNH CÔNG!`);
    console.log(`📄 Đã tạo file: results.json`);
    console.log(`📊 Tổng số bản ghi tạo ra: ${results.length}`);
    console.log("-----------------------------------------");
    console.log("💡 Bây giờ bạn có thể chạy: node importResults.js");
} catch (error) {
    console.error("❌ Lỗi khi ghi file:", error);
}