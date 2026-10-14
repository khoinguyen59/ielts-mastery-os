/**
 * IELTS Mastery OS — Reading-to-Writing Studio
 * Decoupled Micro-Chunks Task 2 Practice & Lexical Upgrades (< 150 lines).
 */
(function() {
    const state = {
        currentChunkId: 'chunk_01'
    };

    const $ = id => document.getElementById(id);
    const $$ = sel => document.querySelectorAll(sel);

    async function apiRequest(endpoint, options = {}) {
        try {
            const res = await fetch(endpoint, options);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`WritingStudio API Error ${endpoint}:`, err);
            return null;
        }
    }

    async function loadChunk(chunkId) {
        state.currentChunkId = chunkId;
        $$('.pill-btn').forEach(tab => tab.classList.toggle('active', tab.dataset.chunk === chunkId));
        
        let chunk = null;
        const res = await apiRequest(`/api/writing/chunks/${chunkId}`);
        if (res && res.data) {
            chunk = res.data;
        } else {
            const fallback = await apiRequest(`/api/writing-chunks/${chunkId}`);
            if (fallback) chunk = fallback;
        }
        if (!chunk) return;

        if ($('chunk-badge')) $('chunk-badge').textContent = `Micro-Chunk: ${chunk.id}`;
        if ($('chunk-title')) $('chunk-title').textContent = chunk.title || 'Writing Task 2';
        if ($('chunk-vietnamese-text')) $('chunk-vietnamese-text').textContent = chunk.vietnamese_prompt || '';

        if ($('target-chips-container')) {
            $('target-chips-container').innerHTML = (chunk.target_words || []).map(tw => 
                `<span style="display:inline-block; margin:3px; padding:4px 10px; background:rgba(28,176,246,0.18); border-radius:999px; font-size:12px; font-weight:700; color:#38bdf8;">[${tw.id}] ${tw.word} (${tw.pos}) • ${tw.core}</span>`
            ).join('');
        }

        if ($('chunk-clues-pills')) {
            $('chunk-clues-pills').innerHTML = (chunk.minimalist_clues || []).map(c => 
                `<span style="display:inline-block; margin:2px; padding:2px 8px; background:rgba(255,255,255,0.08); border-radius:6px; font-size:11px;">${c}</span>`
            ).join('');
        }

        if ($('student-writing-input')) $('student-writing-input').value = '';
        if ($('writing-word-counter')) $('writing-word-counter').textContent = '0 words';
        if ($('writing-feedback-container')) $('writing-feedback-container').style.display = 'none';
    }

    async function evaluateWriting() {
        const input = $('student-writing-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) {
            alert('Vui lòng viết câu dịch trước khi chấm!');
            return;
        }

        let res = await apiRequest('/api/writing/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunk_id: state.currentChunkId, user_submission: text })
        });

        let data = res && res.data ? res.data : null;
        if (!data) {
            const fallback = await apiRequest('/api/writing/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chunk_id: state.currentChunkId, user_text: text })
            });
            if (fallback) data = fallback;
        }

        if (!data) return;

        const matched = data.used_target_words || data.matched_words || [];
        if ($('feedback-msg')) $('feedback-msg').textContent = `${data.feedback} • Khớp: ${matched.join(', ') || 'Chưa đủ'}`;
        if ($('text-model-75')) $('text-model-75').textContent = `"${data.band_75_model}"`;
        if ($('text-model-85')) $('text-model-85').textContent = `"${data.band_85_model}"`;
        if ($('writing-feedback-container')) $('writing-feedback-container').style.display = 'block';

        const ratio = data.coverage_ratio ?? (data.score_ratio ? data.score_ratio / 100 : 0);
        if (ratio >= 0.7) {
            window.soundManager?.playCorrect();
            window.mascotManager?.reactCorrect(1);
        } else {
            window.soundManager?.playReward();
            window.mascotManager?.reactStudy();
        }
        window.progressionManager?.completeNode(4);
    }

    function init() {
        $$('.pill-btn').forEach(tab => tab.addEventListener('click', () => loadChunk(tab.dataset.chunk)));
        $('student-writing-input')?.addEventListener('input', function() {
            const count = this.value.trim() ? this.value.trim().split(/\s+/).length : 0;
            if ($('writing-word-counter')) $('writing-word-counter').textContent = `${count} words`;
        });
        $('evaluate-writing-btn')?.addEventListener('click', evaluateWriting);
        loadChunk('chunk_01');
    }

    window.writingStudio = { init, loadChunk, evaluateWriting };
})();
