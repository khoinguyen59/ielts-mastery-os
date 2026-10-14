/**
 * IELTS Mastery OS — Cambridge 21 Reading Exam Runner
 * Decoupled Exam Simulator with 20-min Countdown & Linearthinking Modals (< 200 lines).
 */
(function() {
    const state = {
        currentPassageId: 't1_p1',
        timerInterval: null,
        timerSeconds: 20 * 60,
        isTimerRunning: false
    };

    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    async function apiRequest(endpoint, options = {}) {
        try {
            const res = await fetch(endpoint, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`ExamRunner API Error ${endpoint}:`, err);
            return null;
        }
    }

    async function loadPassage(passageId) {
        state.currentPassageId = passageId;
        $$('.pass-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.pid === passageId));
        const passage = await apiRequest(`/api/exams/${passageId}`);
        if (!passage) return;

        if ($('passage-display-title')) $('passage-display-title').textContent = passage.title || 'Cambridge IELTS 21';
        if ($('passage-display-subtitle')) $('passage-display-subtitle').textContent = passage.subtitle || '';

        if ($('passage-text-container')) {
            $('passage-text-container').innerHTML = (passage.paragraphs || []).map(p => 
                `<p class="passage-paragraph"><b>${p.label}</b> ${p.text}</p>`
            ).join('');
        }

        const questions = passage.questions || [];
        if ($('questions-list-container')) {
            $('questions-list-container').innerHTML = questions.map(q => `
                <div class="question-item" style="margin-bottom:12px; padding:10px; background:rgba(0,0,0,0.2); border-radius:10px;">
                    <div style="font-size:12px; color:#38bdf8; font-weight:800;">Q${q.number} • ${q.q_type}</div>
                    <div style="font-size:13px; margin-top:4px;">${q.prompt}</div>
                </div>`
            ).join('');
        }

        if ($('sheet-inputs-grid')) {
            $('sheet-inputs-grid').innerHTML = questions.map(q => `
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                    <span style="font-size:12px; font-weight:800; width:35px;">Q${q.number}:</span>
                    <input type="text" class="cell-field duo-search-input" data-qnum="${q.number}" placeholder="Đáp án...">
                </div>`
            ).join('');
        }
    }

    function toggleTimer() {
        const btn = $('exam-timer-toggle-btn');
        if (state.isTimerRunning) {
            clearInterval(state.timerInterval);
            state.isTimerRunning = false;
            if (btn) btn.textContent = 'Start';
        } else {
            state.isTimerRunning = true;
            if (btn) btn.textContent = 'Pause';
            state.timerInterval = setInterval(() => {
                if (state.timerSeconds > 0) {
                    state.timerSeconds--;
                    const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
                    const s = (state.timerSeconds % 60).toString().padStart(2, '0');
                    if ($('exam-timer-display')) $('exam-timer-display').textContent = `${m}:${s}`;
                } else {
                    clearInterval(state.timerInterval);
                    alert('Hết giờ làm bài!');
                }
            }, 1000);
        }
    }

    async function submitExam() {
        const studentAnswers = {};
        $$('.cell-field').forEach(inp => { studentAnswers[inp.dataset.qnum] = inp.value.trim(); });
        const res = await apiRequest('/api/exams/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passage_id: state.currentPassageId, answers: studentAnswers })
        });
        if (!res) return;

        if ($('modal-result-body')) {
            $('modal-result-body').innerHTML = `
                <div style="background: rgba(88,204,2,0.18); padding:14px; border-radius:14px; margin-bottom:14px; border:2px solid var(--duo-green);">
                    <h4 style="color:#4ade80; font-size:16px; font-weight:900;">Đúng ${res.correct_answers}/${res.total_questions} (${res.percentage}%) — Ước tính Band ${res.estimated_band}</h4>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${(res.details || []).map(d => `
                        <div style="background:rgba(0,0,0,0.3); border:1px solid ${d.is_correct ? '#58cc02':'#ff4b4b'}; padding:10px; border-radius:10px; font-size:12px;">
                            <b>Q${d.number}:</b> Đáp án: <b style="color:#38bdf8;">${d.correct_answer}</b> | Bạn điền: <i>${d.user_answer || '(Trống)'}</i>
                            <div style="margin-top:4px; color:#cbd5e1;">${d.explanation}</div>
                        </div>`).join('')}
                </div>`;
        }

        if ($('exam-result-modal')) $('exam-result-modal').style.display = 'flex';
        if (res.percentage >= 70) window.soundManager?.playReward();
        else window.soundManager?.playCorrect();
        window.progressionManager?.completeNode(5);
    }

    function clearExam() {
        $$('.cell-field').forEach(inp => { inp.value = ''; });
    }

    function init() {
        $$('.pass-tab').forEach(tab => tab.addEventListener('click', () => loadPassage(tab.dataset.pid)));
        $('exam-timer-toggle-btn')?.addEventListener('click', toggleTimer);
        $('submit-exam-btn')?.addEventListener('click', submitExam);
        $('clear-exam-btn')?.addEventListener('click', clearExam);
        loadPassage('t1_p1');
    }

    window.examRunner = { init, loadPassage, toggleTimer, submitExam, clearExam };
})();
