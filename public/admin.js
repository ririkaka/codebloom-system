/**
 * CODEBLOOM - ADMIN PANEL LOGIC 
 * Tích hợp 5 mức độ nhận thức & Dashboard trực quan
 */

let allStudents = [];
let allResults = [];
let allQuestionIds = [];

const levelMapping = {
    "Nhớ": ["Q001", "Q002"],
    "Hiểu": ["Q003", "Q004"],
    "Vận dụng": ["Q005", "Q006", "Q007"],
    "Phân tích": ["Q008", "Q009"],
    "Sáng tạo": ["Q010"]
};

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("teacher_token");
    if (!token || token === "undefined") {
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

        allQuestionIds = [...new Set(allResults.map(r => r.question_id))].sort((a, b) => 
            a.localeCompare(b, undefined, {numeric: true})
        );

        buildTableHeader();
        renderMainTable();
        renderEvaluationTable();

    } catch (e) {
        console.error("Lỗi dữ liệu:", e);
    }
});

function buildTableHeader() {
    const headerRow = document.getElementById('header-row');
    if (!headerRow) return;
    let html = `<th>Mã SV</th><th>Họ tên</th>`;
    allQuestionIds.forEach(qId => html += `<th>${qId}</th>`);
    html += `<th>Đúng</th><th>Sai</th><th>Phiên bài làm</th>`;
    headerRow.innerHTML = html;
}

function renderMainTable() {
    const tbody = document.getElementById('data-body');
    if (!tbody) return;
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
    const sessionData = allResults.filter(r => 
        r.student_id === student.student_id && r.session_id === selectedSession
    );
    
    let correct = 0, incorrect = 0;
    let html = `<td><b>${student.student_id}</b></td><td style="text-align:left;">${student.name}</td>`;

    allQuestionIds.forEach(qId => {
        const res = sessionData.find(r => r.question_id === qId);
        if (res) {
            // Sửa lỗi so sánh chữ "Đúng"
            if (res.status === "Đúng" || res.correct === true) {
                html += `<td class="status-ok">✅</td>`;
                correct++;
            } else {
                html += `<td class="status-no">❌</td>`;
                incorrect++;
            }
        } else {
            html += `<td style="color:#ccc">-</td>`;
        }
    });

    html += `<td style="color:green; font-weight:bold">${correct}</td>`;
    html += `<td style="color:red; font-weight:bold">${incorrect}</td>`;
    html += `<td><select onchange="window.changeSession('${student.student_id}', this.value)">`;
    allSessions.forEach(s => html += `<option value="${s}" ${s === selectedSession ? 'selected' : ''}>${s}</option>`);
    html += `</select></td>`;

    tr.innerHTML = html;
}

window.changeSession = (studentId, newSession) => {
    const student = allStudents.find(s => s.student_id === studentId);
    const tr = document.querySelector(`tr[data-student="${studentId}"]`);
    const sessions = [...new Set(allResults.filter(r => r.student_id === studentId).map(r => r.session_id))].sort((a, b) => b.localeCompare(a));
    updateRowContent(tr, student, newSession, sessions);
};

function renderEvaluationTable() {
    const evalBody = document.getElementById('evaluation-body');
    if (!evalBody) return;
    evalBody.innerHTML = "";
    const stats = {};

    Object.keys(levelMapping).forEach(level => {
        let achieveList = [];
        const questions = levelMapping[level];

        allStudents.forEach(student => {
            const studentData = allResults.filter(r => r.student_id === student.student_id);
            const latestSession = [...new Set(studentData.map(r => r.session_id))].sort((a, b) => b.localeCompare(a))[0];

            const isAchieved = allResults.some(r => 
                r.student_id === student.student_id && 
                r.session_id === latestSession && 
                questions.includes(r.question_id) && 
                (r.status === "Đúng" || r.correct === true)
            );
            if (isAchieved) achieveList.push(student.name);
        });

        stats[level] = achieveList.length;
        evalBody.innerHTML += `<tr><td style="font-weight:bold;">${level}</td><td style="color:#007bff; font-weight:bold;">${achieveList.length}</td><td style="text-align:left;">${achieveList.join(", ") || "Chưa có"}</td></tr>`;
    });

    updateVisualDashboard(stats);
}

function updateVisualDashboard(stats) {
    const total = allStudents.length;
    const levelIds = { "Nhớ": "nho", "Hiểu": "hieu", "Vận dụng": "vandung", "Phân tích": "phantich", "Sáng tạo": "sangtao" };

    Object.keys(levelIds).forEach(lvl => {
        const count = stats[lvl] || 0;
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        const valEl = document.getElementById(`val-${levelIds[lvl]}`);
        const cardEl = document.getElementById(`card-${levelIds[lvl]}`);
        
        if (valEl) valEl.innerText = `${percent}%`;
        if (cardEl) {
            if (percent < 30) { cardEl.classList.add('critical'); cardEl.classList.remove('achieved'); }
            else { cardEl.classList.add('achieved'); cardEl.classList.remove('critical'); }
        }
    });
}

function logout() {
    localStorage.removeItem("teacher_token");
    window.location.href = "teacher-login.html";
}