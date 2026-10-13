/**
 * IELTS Mastery OS — Duolingo & Luyện Từ Gamified Orchestrator.
 * Modular Decoupled Architecture (< 400 lines).
 */
document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentView: 'roadmap',
        currentPassageId: 't1_p1',
        currentChunkId: 'chunk_01',
        vocabList: [],
        coins: parseInt(localStorage.getItem('ielts_os_coins') || '120'),
        hearts: parseInt(localStorage.getItem('ielts_os_hearts') || '5'),
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
            console.error(`API Error ${endpoint}:`, err);
            return null;
        }
    }

    // 1. Navigation & View Routing
    function switchView(viewName) {
        if (window.progressionManager && !window.progressionManager.isTabUnlocked(viewName)) {
            window.progressionManager.handleLockedTab(viewName, document.querySelector(`.nav-tab[data-view="${viewName}"]`));
            return;
        }
        if (viewName === 'quiz' && window.energyManager && !window.energyManager.canStartLesson()) return;
        state.currentView = viewName;
        $$('.nav-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewName));
        $$('.view-panel').forEach(p => p.classList.toggle('active', p.id === `view-${viewName}`));
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (viewName === 'flashcard' && window.flashcardStudio) {
            window.flashcardStudio.init(state.vocabList);
            window.mascotManager?.setEmotion('study', 'Lật thẻ và phản xạ phát âm nào!');
        } else if (viewName === 'quiz' && window.quizBlitz) {
            window.quizBlitz.startRound(10);
        } else if (viewName === 'roadmap') {
            updateRoadmapStats();
        }
    }

    $$('.nav-tab').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $$('[data-action="back-to-roadmap"]').forEach(b => b.addEventListener('click', () => switchView('roadmap')));

    // 2. Roadmap Node Actions (Event Delegation for Dynamic Nodes)
    const nodeActions = { 'open-flashcard': 'flashcard', 'open-quiz': 'quiz', 'open-writing': 'writing', 'open-exam': 'exam' };
    const nodeIdxMap = { 'open-flashcard': 1, 'open-quiz': 2, 'claim-chest': 3, 'open-writing': 4, 'open-exam': 5 };

    $('view-roadmap')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const act = btn.dataset.action;
        if (act === 'claim-chest') {
            if (window.progressionManager && !window.progressionManager.isNodeUnlocked(3)) return window.progressionManager.handleLockedNode(3, btn);
            state.coins += 50;
            localStorage.setItem('ielts_os_coins', state.coins.toString());
            updateTopbarStats();
            window.soundManager?.playReward();
            window.mascotManager?.setEmotion('celebrate', '🎉 Chúc mừng! Nhận được +50 Coin từ Rương Báu!', 3500);
            return window.progressionManager?.completeNode(3);
        }
        if (nodeActions[act]) {
            const idx = nodeIdxMap[act];
            if (window.progressionManager && !window.progressionManager.isNodeUnlocked(idx)) return window.progressionManager.handleLockedNode(idx, btn);
            switchView(nodeActions[act]);
        }
    });

    $('sidebar-quick-play-btn')?.addEventListener('click', () => {
        if (window.progressionManager && !window.progressionManager.isNodeUnlocked(2)) {
            window.progressionManager.handleLockedNode(2, $('sidebar-quick-play-btn'));
            return;
        }
        switchView('quiz');
    });

    // 3. Topbar Controls & Storage
    function updateTopbarStats() {
        const streak = window.localStore?.getStreak() || { current: 1 };
        if ($('topbar-streak-val')) $('topbar-streak-val').textContent = streak.current;
        const coins = window.energyManager?.coins ?? state.coins;
        if ($('topbar-coin-val')) $('topbar-coin-val').textContent = coins;
        const hearts = window.energyManager?.hearts ?? state.hearts ?? 5;
        if ($('topbar-heart-val')) $('topbar-heart-val').textContent = hearts;
    }

    function initTopbar() {
        updateTopbarStats();
        $('btn-toggle-sfx')?.addEventListener('click', function() { this.textContent = window.soundManager.toggleSfx() ? '🔊' : '🔇'; });
        $('btn-toggle-bgm')?.addEventListener('click', function() { this.textContent = window.soundManager.toggleBgm() ? '🎵 On' : '🎵'; });
        $('btn-export-backup')?.addEventListener('click', () => window.localStore.exportBackupJson());
        $('input-import-backup')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) window.localStore.importBackupJson(file, (ok, msg) => { alert(msg); if (ok) location.reload(); });
        });
        $('cabi-companion-avatar')?.addEventListener('click', () => {
            window.soundManager.playReward();
            window.mascotManager.setEmotion('celebrate', 'Cabi đây! Cùng học chăm để bứt phá 7.5+ nhé!', 3000);
        });
    }

    function updateRoadmapStats() { updateTopbarStats(); }

    // 4. Flashcard Studio Wiring
    function initFlashcardEvents() {
        $$('.btn-rate').forEach(btn => btn.addEventListener('click', () => {
            window.flashcardStudio.rateCurrentWord(parseFloat(btn.dataset.score));
            window.progressionManager?.completeNode(1);
        }));
        $('fc-prev-btn')?.addEventListener('click', () => window.flashcardStudio.prevCard());
        $('fc-next-btn')?.addEventListener('click', () => window.flashcardStudio.nextCard());
        $('fc-flip-btn')?.addEventListener('click', () => window.flashcardStudio.flipCard());
    }

    // 5. Reading Exam Simulator
    async function loadPassage(passageId) {
        state.currentPassageId = passageId;
        $$('.pass-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.pid === passageId));
        const passage = await apiRequest(`/api/exams/${passageId}`);
        if (!passage) return;

        $('passage-display-title').textContent = passage.title || 'Cambridge IELTS 21';
        $('passage-display-subtitle').textContent = passage.subtitle || '';
        $('passage-text-container').innerHTML = (passage.paragraphs || []).map(p => 
            `<p class="passage-paragraph"><b>${p.label}</b> ${p.text}</p>`
        ).join('');

        const questions = passage.questions || [];
        $('questions-list-container').innerHTML = questions.map(q => `
            <div class="question-item" style="margin-bottom:12px; padding:10px; background:rgba(0,0,0,0.2); border-radius:10px;">
                <div style="font-size:12px; color:#38bdf8; font-weight:800;">Q${q.number} • ${q.q_type}</div>
                <div style="font-size:13px; margin-top:4px;">${q.prompt}</div>
            </div>`
        ).join('');

        $('sheet-inputs-grid').innerHTML = questions.map(q => `
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <span style="font-size:12px; font-weight:800; width:35px;">Q${q.number}:</span>
                <input type="text" class="cell-field duo-search-input" data-qnum="${q.number}" placeholder="Đáp án...">
            </div>`
        ).join('');
    }

    $$('.pass-tab').forEach(tab => tab.addEventListener('click', () => loadPassage(tab.dataset.pid)));

    $('exam-timer-toggle-btn')?.addEventListener('click', function() {
        if (state.isTimerRunning) {
            clearInterval(state.timerInterval);
            state.isTimerRunning = false;
            this.textContent = 'Start';
        } else {
            state.isTimerRunning = true;
            this.textContent = 'Pause';
            state.timerInterval = setInterval(() => {
                if (state.timerSeconds > 0) {
                    state.timerSeconds--;
                    const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
                    const s = (state.timerSeconds % 60).toString().padStart(2, '0');
                    $('exam-timer-display').textContent = `${m}:${s}`;
                } else {
                    clearInterval(state.timerInterval);
                    alert('Hết giờ làm bài!');
                }
            }, 1000);
        }
    });

    $('submit-exam-btn')?.addEventListener('click', async () => {
        const studentAnswers = {};
        $$('.cell-field').forEach(inp => { studentAnswers[inp.dataset.qnum] = inp.value.trim(); });
        const res = await apiRequest('/api/exams/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passage_id: state.currentPassageId, answers: studentAnswers })
        });
        if (!res) return;
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
        $('exam-result-modal').style.display = 'flex';
        if (res.percentage >= 70) window.soundManager?.playReward();
        else window.soundManager?.playCorrect();
        window.progressionManager?.completeNode(5);
    });

    $('clear-exam-btn')?.addEventListener('click', () => { $$('.cell-field').forEach(inp => { inp.value = ''; }); });

    // 6. Reading-to-Writing Studio
    async function loadWritingChunk(chunkId) {
        state.currentChunkId = chunkId;
        $$('.pill-btn').forEach(tab => tab.classList.toggle('active', tab.dataset.chunk === chunkId));
        const chunk = await apiRequest(`/api/writing-chunks/${chunkId}`);
        if (!chunk) return;

        $('chunk-badge').textContent = `Micro-Chunk: ${chunk.id}`;
        $('chunk-title').textContent = chunk.title || 'Writing Task 2';
        $('chunk-vietnamese-text').textContent = chunk.vietnamese_prompt || '';
        $('target-chips-container').innerHTML = (chunk.target_words || []).map(tw => 
            `<span style="display:inline-block; margin:3px; padding:4px 10px; background:rgba(28,176,246,0.18); border-radius:999px; font-size:12px; font-weight:700; color:#38bdf8;">[${tw.id}] ${tw.word} (${tw.pos}) • ${tw.core}</span>`
        ).join('');
        $('chunk-clues-pills').innerHTML = (chunk.minimalist_clues || []).map(c => `<span style="display:inline-block; margin:2px; padding:2px 8px; background:rgba(255,255,255,0.08); border-radius:6px; font-size:11px;">${c}</span>`).join('');
        $('student-writing-input').value = '';
        $('writing-word-counter').textContent = '0 words';
        $('writing-feedback-container').style.display = 'none';
    }

    $$('.pill-btn').forEach(tab => tab.addEventListener('click', () => loadWritingChunk(tab.dataset.chunk)));

    $('student-writing-input')?.addEventListener('input', function() {
        const count = this.value.trim() ? this.value.trim().split(/\s+/).length : 0;
        $('writing-word-counter').textContent = `${count} words`;
    });

    $('evaluate-writing-btn')?.addEventListener('click', async () => {
        const text = $('student-writing-input').value.trim();
        if (!text) { alert('Vui lòng viết câu dịch trước khi chấm!'); return; }
        const res = await apiRequest('/api/writing/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunk_id: state.currentChunkId, user_text: text })
        });
        if (!res) return;
        $('feedback-msg').textContent = `${res.feedback} • Khớp: ${(res.matched_words || []).join(', ') || 'Chưa đủ'}`;
        $('text-model-75').textContent = `"${res.band_75_model}"`;
        $('text-model-85').textContent = `"${res.band_85_model}"`;
        $('writing-feedback-container').style.display = 'block';

        if (res.score_ratio >= 0.7) {
            window.soundManager?.playCorrect();
            window.mascotManager?.reactCorrect(1);
        } else {
            window.soundManager?.playReward();
            window.mascotManager?.reactStudy();
        }
        window.progressionManager?.completeNode(4);
    });

    // 7. Master 450 Lexicon
    async function loadVocabList() {
        const res = await apiRequest('/api/vocab');
        if (!res || !res.data) return;
        state.vocabList = res.data;
        renderVocabCards(res.data);
    }

    function renderVocabCards(words) {
        $('vocab-count-indicator').textContent = `${words.length} Words`;
        $('vocab-cards-grid').innerHTML = words.slice(0, 90).map(w => {
            const sc = window.localStore?.getWordScore(w.id, w.score) || w.score;
            return `<div class="word-card" data-word="${w.word}" style="background:var(--bg-surface); border:2px solid var(--duo-gray); border-radius:14px; padding:12px; cursor:pointer;">
                <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:800; color:#38bdf8;"><span>[${w.id}]</span><span>★ ${sc.toFixed(1)}</span></div>
                <div style="font-size:16px; font-weight:900; margin-top:2px;">${w.word} <i style="font-size:11px; color:#94a3b8;">${w.pos}</i></div>
                <div style="font-size:12px; color:#e2e8f0; margin-top:3px;">${w.meaning}</div></div>`;
        }).join('');

        $$('.word-card').forEach(card => card.addEventListener('click', () => {
            const target = state.vocabList.find(w => w.word === card.dataset.word);
            if (target) showVocabDetail(target);
        }));
    }

    function filterVocab() {
        const q = $('vocab-search-input').value.toLowerCase().trim();
        const pos = $('vocab-pos-select').value.toLowerCase().trim();
        const filtered = state.vocabList.filter(w => {
            const matchQ = !q || w.word.toLowerCase().includes(q) || (w.meaning && w.meaning.toLowerCase().includes(q)) || w.id.includes(q);
            const matchPos = !pos || (w.pos && w.pos.toLowerCase().includes(pos));
            return matchQ && matchPos;
        });
        renderVocabCards(filtered);
    }

    $('vocab-search-input')?.addEventListener('input', filterVocab);
    $('vocab-pos-select')?.addEventListener('change', filterVocab);

    function showVocabDetail(w) {
        $('vocab-modal-title').textContent = `[${w.id}] ${w.word.toUpperCase()} (${w.pos})`;
        const sc = window.localStore?.getWordScore(w.id, w.score) || w.score;
        $('vocab-modal-body').innerHTML = `
            <div style="font-size:14px; margin-bottom:10px; color:#38bdf8; font-family:var(--font-mono);">${w.ipa || ''} • Điểm nhớ: ★ ${sc.toFixed(1)}/7.0</div>
            <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; margin-bottom:10px;"><b>Nghĩa:</b> ${w.meaning}</div>
            <div style="margin-bottom:6px;"><b>Collocations:</b> ${w.collocations || 'N/A'}</div>
            <div style="margin-bottom:6px;"><b>Gốc Lego:</b> ${w.lego_roots || 'N/A'}</div>
            <div><b>Ví dụ Cam 21:</b> ${w.example || 'N/A'}</div>`;
        $('vocab-detail-modal').style.display = 'flex';
    }

    $('modal-close-btn')?.addEventListener('click', () => { $('exam-result-modal').style.display = 'none'; });
    $('vocab-modal-close-btn')?.addEventListener('click', () => { $('vocab-detail-modal').style.display = 'none'; });
    window.addEventListener('click', e => {
        if (e.target === $('exam-result-modal') || e.target === $('vocab-detail-modal')) e.target.style.display = 'none';
    });

    // 8. Analytics & PDFs
    async function loadAnalytics() {
        const data = await apiRequest('/api/analytics');
        if (!data) return;
        if ($('traps-breakdown-list') && data.trap_distribution) {
            const traps = Object.entries(data.trap_distribution);
            $('traps-breakdown-list').innerHTML = traps.map(([t, c]) => `<div style="margin-bottom:8px; font-size:12px;"><b>${t}:</b> ${c} câu</div>`).join('');
        }
        if ($('tiers-breakdown-container') && data.vocab_tiers) {
            const t = data.vocab_tiers;
            $('tiers-breakdown-container').innerHTML = `<div style="font-size:12px; line-height:1.6;"><div>🟢 5.0–7.0 (Rất vững): <b>${t.tier_mastered}</b> từ</div><div>🟡 3.0–4.9 (Củng cố): <b>${t.tier_solid}</b> từ</div><div>🔴 1.0–2.9 (Cần ôn): <b>${t.tier_learning}</b> từ</div></div>`;
        }
        if ($('pdf-downloads-grid')) {
            const pdfs = [{ t: 'Master 5-Passage Complete Collection', f: 'cam21_reading_mastery_5_tests_complete.pdf' }, { t: 'Cam 21 Test 1 P1 (Davies Sisters)', f: 'cam21_test1_reading_passage1.pdf' }, { t: 'Cam 21 Test 1 P2 (Silence)', f: 'cam21_test1_reading_passage2.pdf' }, { t: 'Cam 21 Test 1 P3 (Sugar)', f: 'cam21_test1_reading_passage3.pdf' }, { t: 'Cam 21 Test 2 P1 (Animals Dream)', f: 'cam21_test2_reading_passage1.pdf' }, { t: 'Cam 21 Test 2 P3 (AI Ethics)', f: 'cam21_test2_reading_passage3.pdf' }];
            $('pdf-downloads-grid').innerHTML = pdfs.map(p => `<a href="/${p.f}" target="_blank" style="display:block; padding:10px 14px; background:var(--bg-card); border-radius:10px; color:#38bdf8; text-decoration:none; margin-bottom:8px; font-weight:700; font-size:12.5px;">📄 ${p.t} ↗</a>`).join('');
        }
    }

    // Initialize App
    initTopbar();
    window.authManager?.init();
    window.energyManager?.init();
    window.progressionManager?.init();
    initFlashcardEvents();
    loadAnalytics();
    loadPassage('t1_p1');
    loadWritingChunk('chunk_01');
    loadVocabList();
});
