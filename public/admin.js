async function loadAdminData() {
    try {
        console.log("Đang tải dữ liệu từ API...");
        const [resResults, resQuestions] = await Promise.all([
            fetch('/api/admin/results').then(r => r.json()),
            fetch('/api/questions').then(r => r.json())
        ]);

        if (!resResults || resResults.length === 0) {
            console.warn("Chưa có dữ liệu làm bài.");
            return;
        }

        // Lọc lấy phiên cuối cùng của mỗi học sinh
        const latestResultsOnly = getLatestResults(resResults);

        // Cập nhật các thẻ Card (Sửa lỗi 0%)
        updateHeaderCards(latestResultsOnly, resQuestions);

        // Hiển thị bảng chi tiết và bảng mức độ đạt
        renderGroupedTable(resResults);
        renderLevelSummaryTable(latestResultsOnly, resQuestions);

    } catch (error) {
        console.error("Lỗi hệ thống:", error);
    }
}

function getLatestResults(allResults) {
    const latestMap = new Map();
    const sorted = [...allResults].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    sorted.forEach(r => {
        if (!latestMap.has(r.student_id)) latestMap.set(r.student_id, r.session_id);
    });
    return allResults.filter(r => latestMap.get(r.student_id) === r.session_id);
}

function updateHeaderCards(latestResults, questions) {
    // Bản đồ khớp chính xác với ID trong HTML của bạn
    const levelConfig = [
        { name: "Nhớ", id: "val-nho" },
        { name: "Hiểu", id: "val-hieu" },
        { name: "Vận dụng", id: "val-vandung" },
        { name: "Phân tích", id: "val-phantich" },
        { name: "Sáng tạo", id: "val-sangtao" }
    ];

    levelConfig.forEach(cfg => {
        // Lấy danh sách ID câu hỏi thuộc mức độ này (So khớp chính xác chữ có dấu)
        const qIdsInLevel = questions
            .filter(q => q.level.trim() === cfg.name)
            .map(q => q.question_id);

        const resultsInLevel = latestResults.filter(r => qIdsInLevel.includes(r.question_id));
        const correctCount = resultsInLevel.filter(r => r.correct === true).length;
        
        const percentage = resultsInLevel.length > 0 
            ? Math.round((correctCount / resultsInLevel.length) * 100) 
            : 0;

        const el = document.getElementById(cfg.id);
        if (el) el.innerText = `${percentage}%`;
    });
}

function renderGroupedTable(results) {
    const tableBody = document.getElementById('data-body');
    if (!tableBody) return;

    const studentGroups = {};
    results.forEach(r => {
        const sId = r.student_id;
        if (!studentGroups[sId]) {
            studentGroups[sId] = {
                name: (r.student_info && r.student_info[0]) ? r.student_info[0].name : `HS ${sId}`,
                sessions: {}
            };
        }
        if (!studentGroups[sId].sessions[r.session_id]) {
            studentGroups[sId].sessions[r.session_id] = { details: {}, correct: 0, total: 0 };
        }
        const session = studentGroups[sId].sessions[r.session_id];
        session.details[r.question_id] = r.correct;
        if (r.correct) session.correct++;
        session.total++;
    });

    window.allStudentData = studentGroups;
    const sortedIds = Object.keys(studentGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    tableBody.innerHTML = sortedIds.map(sId => {
        const data = studentGroups[sId];
        const sessionIds = Object.keys(data.sessions).sort().reverse();
        const cur = data.sessions[sessionIds[0]];

        return `
            <tr id="row-${sId}">
                <td>${sId}</td>
                <td style="text-align:left; font-weight:bold; color:#007bff">${data.name}</td>
                ${renderResultCells(cur.details)}
                <td style="color:#2ecc71; font-weight:bold">${cur.correct}</td>
                <td style="color:#e74c3c; font-weight:bold">${cur.total - cur.correct}</td>
                <td>
                    <select class="form-select-sm" onchange="changeSession(this, '${sId}')">
                        ${sessionIds.map(id => `<option value="${id}">${id}</option>`).join('')}
                    </select>
                </td>
            </tr>`;
    }).join('');
}

function renderLevelSummaryTable(latestResults, questions) {
    const levelTableBody = document.getElementById('evaluation-body');
    if (!levelTableBody) return;

    const levels = ["Nhớ", "Hiểu", "Vận dụng", "Phân tích", "Sáng tạo"];
    const studentPerf = {};

    latestResults.forEach(r => {
        if (!studentPerf[r.student_id]) {
            studentPerf[r.student_id] = { 
                name: (r.student_info && r.student_info[0]) ? r.student_info[0].name : r.student_id,
                correctQs: new Set() 
            };
        }
        if (r.correct) studentPerf[r.student_id].correctQs.add(r.question_id);
    });

    levelTableBody.innerHTML = levels.map(level => {
        const qIdsInLevel = questions.filter(q => q.level.trim() === level).map(q => q.question_id);
        const qualifiedStudents = Object.values(studentPerf).filter(s => {
            const correctCount = qIdsInLevel.filter(qId => s.correctQs.has(qId)).length;
            return qIdsInLevel.length > 0 && (correctCount / qIdsInLevel.length) >= 0.8;
        }).map(s => s.name);

        return `
            <tr>
                <td style="font-weight:bold">${level}</td>
                <td><span class="badge-count">${qualifiedStudents.length}</span></td>
                <td style="text-align:left">${qualifiedStudents.length > 0 ? qualifiedStudents.join(', ') : '<em>Chưa có HS đạt</em>'}</td>
            </tr>`;
    }).join('');
}

function renderResultCells(details) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => {
        const qId = `Q${i.toString().padStart(3, '0')}`;
        const status = details[qId];
        if (status === true) return '<td style="color:#2ecc71">✅</td>';
        if (status === false) return '<td style="color:#e74c3c">❌</td>';
        return '<td style="color:#ccc">-</td>';
    }).join('');
}

function changeSession(selectElement, sId) {
    const sessionId = selectElement.value;
    const sessionData = window.allStudentData[sId].sessions[sessionId];
    const row = document.getElementById(`row-${sId}`);
    // Xóa các ô từ Q001 đến phiên bài làm (index 2 đến cuối)
    while(row.cells.length > 2) { row.deleteCell(2); }
    
    // Chèn lại các ô mới
    const detailsHtml = renderResultCells(sessionData.details);
    const summaryHtml = `
        <td style="color:#2ecc71; font-weight:bold">${sessionData.correct}</td>
        <td style="color:#e74c3c; font-weight:bold">${sessionData.total - sessionData.correct}</td>
        <td>
            <select class="form-select-sm" onchange="changeSession(this, '${sId}')">
                ${Object.keys(window.allStudentData[sId].sessions).sort().reverse().map(id => 
                    `<option value="${id}" ${id === sessionId ? 'selected' : ''}>${id}</option>`
                ).join('')}
            </select>
        </td>
    `;
    
    const temp = document.createElement('tbody');
    temp.innerHTML = `<tr>${detailsHtml}${summaryHtml}</tr>`;
    const newCells = temp.firstChild.cells;
    while(newCells.length > 0) {
        row.appendChild(newCells[0]);
    }
}

document.addEventListener('DOMContentLoaded', loadAdminData);