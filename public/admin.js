let allStudents = [];
let allResults = [];
let allQuestionIds = [];

// 1. Phân loại mức độ nhận thức (Bạn có thể sửa Qxxx theo file questions.json của mình)
const levelMapping = {
    "Nhớ": ["Q001", "Q002"],
    "Hiểu": ["Q003", "Q004"],
    "Vận dụng": ["Q005", "Q006"],
    "Phân tích": ["Q007", "Q008"],
    "Sáng tạo": ["Q009", "Q010"]
};

document.addEventListener("DOMContentLoaded", async () => {
    // Kiểm tra quyền truy cập
    if (localStorage.getItem("teacher_token") !== "valid") {
        window.location.href = "teacher-login.html";
        return;
    }

    try {
        const [resS, resR] = await Promise.all([
            fetch('/api/students'),
            fetch('/api/results')
        ]);
        allStudents = await resS.json();
        allResults = await resR.json();

        // Lấy danh sách mã câu hỏi duy nhất và sắp xếp
        allQuestionIds = [...new Set(allResults.map(r => r.question_id))].sort((a, b) => 
            a.localeCompare(b, undefined, {numeric: true})
        );

        // Xây dựng Header động cho bảng kết quả
        buildTableHeader();
        
        // Hiển thị bảng kết quả
        renderMainTable();
        
        // Hiển thị bảng đánh giá mức độ
        renderEvaluationTable();

    } catch (e) {
        console.error("Lỗi tải dữ liệu:", e);
    }
});

function buildTableHeader() {
    const headerRow = document.getElementById('header-row');
    headerRow.innerHTML = `<th>Mã SV</th><th>Họ tên</th>`;
    
    allQuestionIds.forEach(qId => {
        const th = document.createElement('th');
        th.innerText = qId;
        headerRow.appendChild(th);
    });
    
    headerRow.innerHTML += `<th>Đúng</th><th>Sai</th><th>Phiên bài làm</th>`;
}

function renderMainTable() {
    const tbody = document.getElementById('data-body');
    tbody.innerHTML = "";

    allStudents.forEach(student => {
        const studentData = allResults.filter(r => r.student_id === student.student_id);
        const sessions = [...new Set(studentData.map(r => r.session_id))].sort((a, b) => b.localeCompare(a));
        const latestSession = sessions[0] || "";

        const tr = document.createElement('tr');
        tr.setAttribute('data-student', student.student_id);
        updateRowContent(tr, student, latestSession, sessions);
        tbody.appendChild(tr);
    });
}

function updateRowContent(tr, student, selectedSession, allSessions) {
    const studentData = allResults.filter(r => 
        r.student_id === student.student_id && r.session_id === selectedSession
    );
    
    let correct = 0;
    let incorrect = 0;

    let html = `<td>${student.student_id}</td><td style="text-align:left; font-weight:500;">${student.name}</td>`;

    allQuestionIds.forEach(qId => {
        const res = studentData.find(r => r.question_id === qId);
        if (res) {
            if (res.correct === true || res.correct === "true") {
                html += `<td class="status-ok">✅</td>`;
                correct++;
            } else {
                html += `<td class="status-no">❌</td>`;
                incorrect++;
            }
        } else {
            html += `<td>-</td>`;
        }
    });

    html += `<td style="color:green; font-weight:bold">${correct}</td>`;
    html += `<td style="color:red; font-weight:bold">${incorrect}</td>`;
    html += `<td><select onchange="window.changeSession('${student.student_id}', this.value)">`;
    
    if (allSessions.length === 0) {
        html += `<option>Trống</option>`;
    } else {
        allSessions.forEach(s => {
            html += `<option value="${s}" ${s === selectedSession ? 'selected' : ''}>${s}</option>`;
        });
    }
    html += `</select></td>`;

    tr.innerHTML = html;
}

window.changeSession = function(studentId, newSession) {
    const student = allStudents.find(s => s.student_id === studentId);
    const tr = document.querySelector(`tr[data-student="${studentId}"]`);
    const studentData = allResults.filter(r => r.student_id === studentId);
    const sessions = [...new Set(studentData.map(r => r.session_id))].sort((a, b) => b.localeCompare(a));
    updateRowContent(tr, student, newSession, sessions);
};

function renderEvaluationTable() {
    const evalBody = document.getElementById('evaluation-body');
    evalBody.innerHTML = "";

    Object.keys(levelMapping).forEach(level => {
        let achieveList = [];
        const questions = levelMapping[level];

        allStudents.forEach(student => {
            const studentData = allResults.filter(r => r.student_id === student.student_id);
            const latestSession = [...new Set(studentData.map(r => r.session_id))].sort((a, b) => b.localeCompare(a))[0];

            // Nếu trong phiên cuối làm đúng ít nhất 1 câu thuộc mức độ này
            const isAchieved = allResults.some(r => 
                r.student_id === student.student_id && 
                r.session_id === latestSession && 
                questions.includes(r.question_id) && 
                r.correct === true
            );

            if (isAchieved) achieveList.push(student.name);
        });

        evalBody.innerHTML += `
            <tr>
                <td style="text-align:left; font-weight:bold; padding-left:20px;">${level}</td>
                <td style="color:#007bff; font-weight:bold; font-size:18px;">${achieveList.length}</td>
                <td style="text-align:left; color:#555; font-style:italic;">
                    ${achieveList.length > 0 ? achieveList.join(", ") : "Chưa có"}
                </td>
            </tr>
        `;
    });
}

function logout() {
    if (confirm("Xác nhận đăng xuất?")) {
        localStorage.removeItem("teacher_token");
        window.location.href = "teacher-login.html";
    }
}