/**
 * IELTS Mastery OS — Master Application Orchestrator
 * Fully Decoupled Architecture (< 180 lines).
 */
document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentView: 'roadmap',
        vocabList: [],
        coins: parseInt(localStorage.getItem('ielts_os_coins') || '120'),
        hearts: parseInt(localStorage.getItem('ielts_os_hearts') || '5')
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
            updateTopbarStats();
        }
    }

    $$('.nav-tab').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $$('[data-action="back-to-roadmap"]').forEach(b => b.addEventListener('click', () => switchView('roadmap')));

    // 2. Roadmap Node Actions
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

    // 4. Master 450 Lexicon
    async function loadVocabList() {
        const res = await apiRequest('/api/vocab');
        if (!res || !res.data) return;
        state.vocabList = res.data;
        renderVocabCards(res.data);
    }

    function renderVocabCards(words) {
        if (!$('vocab-count-indicator') || !$('vocab-cards-grid')) return;
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
        const q = ($('vocab-search-input')?.value || '').toLowerCase().trim();
        const pos = ($('vocab-pos-select')?.value || '').toLowerCase().trim();
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
        if (!$('vocab-modal-title') || !$('vocab-modal-body')) return;
        $('vocab-modal-title').textContent = `[${w.id}] ${w.word.toUpperCase()} (${w.pos})`;
        const sc = window.localStore?.getWordScore(w.id, w.score) || w.score;
        $('vocab-modal-body').innerHTML = `
            <div style="font-size:14px; margin-bottom:10px; color:#38bdf8; font-family:var(--font-mono);">${w.ipa || ''} • Điểm nhớ: ★ ${sc.toFixed(1)}/7.0</div>
            <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px; margin-bottom:10px;"><b>Nghĩa:</b> ${w.meaning}</div>
            <div style="margin-bottom:6px;"><b>Collocations:</b> ${w.collocations || 'N/A'}</div>
            <div style="margin-bottom:6px;"><b>Gốc Lego:</b> ${w.lego_roots || 'N/A'}</div>
            <div><b>Ví dụ Cam 21:</b> ${w.example || 'N/A'}</div>`;
        if ($('vocab-detail-modal')) $('vocab-detail-modal').style.display = 'flex';
    }

    $('modal-close-btn')?.addEventListener('click', () => { $('exam-result-modal').style.display = 'none'; });
    $('vocab-modal-close-btn')?.addEventListener('click', () => { $('vocab-detail-modal').style.display = 'none'; });
    window.addEventListener('click', e => {
        if (e.target === $('exam-result-modal') || e.target === $('vocab-detail-modal')) e.target.style.display = 'none';
    });

    // 5. Analytics & PDF Exports
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
            const pdfs = [
                { t: 'Master 5-Passage Complete Collection', f: 'cam21_reading_mastery_5_tests_complete.pdf' },
                { t: 'Cam 21 Test 1 P1 (Davies Sisters)', f: 'cam21_test1_reading_passage1.pdf' },
                { t: 'Cam 21 Test 1 P2 (Silence)', f: 'cam21_test1_reading_passage2.pdf' },
                { t: 'Cam 21 Test 1 P3 (Sugar)', f: 'cam21_test1_reading_passage3.pdf' },
                { t: 'Cam 21 Test 2 P1 (Animals Dream)', f: 'cam21_test2_reading_passage1.pdf' },
                { t: 'Cam 21 Test 2 P2 (Mapungubwe)', f: 'cam21_test2_reading_passage2.pdf' },
                { t: 'Cam 21 Test 2 P3 (AI Ethics)', f: 'cam21_test2_reading_passage3.pdf' }
            ];
            $('pdf-downloads-grid').innerHTML = pdfs.map(p => `<a href="/${p.f}" target="_blank" style="display:block; padding:10px 14px; background:var(--bg-card); border-radius:10px; color:#38bdf8; text-decoration:none; margin-bottom:8px; font-weight:700; font-size:12.5px;">📄 ${p.t} ↗</a>`).join('');
        }
    }

    // Initialize All Decoupled Subsystems
    initTopbar();
    window.authManager?.init();
    window.placementManager?.init();
    window.energyManager?.init();
    window.progressionManager?.init();
    window.courseManager?.init();
    window.examRunner?.init();
    window.writingStudio?.init();
    loadAnalytics();
    loadVocabList();
});
