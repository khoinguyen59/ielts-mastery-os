/**
 * Progression Manager: Dynamic Multi-Tier Course Winding Path & Prerequisite State Machine (R4).
 * Modular Gamified Architecture (< 240 lines).
 */
class ProgressionManager {
    constructor() {
        this.unitId = 'unit_01';
        this.unlockedNode = 1;
        this.completedNodes = [];
        this.currentCourse = null;
        this.currentLevel = localStorage.getItem('ielts_user_level') || 'intermediate';
        this.nodeNames = {
            1: 'Chặng 1: Nạp Flashcard 3D',
            2: 'Chặng 2: Đấu Trường Quiz Blitz',
            3: 'Chặng 3: Mở Rương Coin',
            4: 'Chặng 4: Luyện Dịch Task 2',
            5: 'Chặng 5: Thử Thách Cam 21'
        };
        this.tabToNode = { quiz: 2, writing: 4, exam: 5 };
        this.userId = localStorage.getItem('ielts_os_user_id') || 'default_user';
        this._load();
    }

    init(user) {
        this.userId = user?.id || localStorage.getItem('ielts_os_user_id') || 'default_user';
        this.currentLevel = localStorage.getItem('ielts_user_level') || 'intermediate';
        this._load();
        this._ensureDrawerDOM();
        this.loadCourse();
    }

    _load() {
        try {
            const saved = JSON.parse(localStorage.getItem('ielts_os_progression') || '{}');
            this.unlockedNode = Math.max(1, Math.min(5, saved.unlockedNode || 1));
            this.completedNodes = Array.isArray(saved.completedNodes) ? saved.completedNodes : [];
        } catch (_) {
            this.unlockedNode = 1;
            this.completedNodes = [];
        }
    }

    async loadCourse() {
        try {
            const level = this.currentLevel || localStorage.getItem('ielts_user_level') || 'intermediate';
            const res = await fetch(`/api/courses/active?user_id=${encodeURIComponent(this.userId)}&level=${encodeURIComponent(level)}`);
            if (res.ok) {
                const data = await res.json();
                if (data?.data?.course) {
                    this.currentCourse = data.data.course;
                    this.unitId = this.currentCourse.units[0]?.id || 'unit_01';
                    this.renderRoadmapPath();
                    this.renderLocks();
                    return;
                }
            }
        } catch (err) {
            console.warn('Could not load dynamic course:', err);
        }
        this.renderLocks();
    }

    reloadForLevel(newLevel) {
        this.currentLevel = newLevel;
        localStorage.setItem('ielts_user_level', newLevel);
        this.unlockedNode = 1;
        this.completedNodes = [];
        this._save();
        this.loadCourse();
    }

    renderRoadmapPath() {
        const container = document.getElementById('winding-path-scroll-area');
        if (!container || !this.currentCourse) return;

        const u1 = this.currentCourse.units[0];
        const u2 = this.currentCourse.units[1];
        const themeClass = `unit-${u1.colorTheme || 'blue'}`;

        container.innerHTML = `
            <!-- ACTIVE UNIT BANNER -->
            <div class="path-unit-card ${themeClass}">
                <div class="unit-banner-head">
                    <div>
                        <span class="unit-sub">${u1.subtitle} • BAND ${this.currentCourse.targetBand}</span>
                        <h2 class="unit-title">${u1.title}</h2>
                    </div>
                    <span class="unit-badge">${u1.tag}</span>
                </div>
            </div>

            <!-- WINDING PATH NODES -->
            <div class="winding-nodes-column">
                <div class="path-node-row pos-center">
                    <button class="path-bubble-node node-active" data-action="open-flashcard" title="Chặng 1: Nạp Flashcard 3D">
                        <span class="node-icon"><img src="assets/icons/badge_flashcard.svg" class="node-svg" alt="Flashcard"></span>
                        <span class="node-crown">👑</span>
                        <div class="node-pulse-ring"></div>
                    </button>
                    <span class="node-label">Nạp Từ Mục Tiêu</span>
                </div>

                <div class="path-node-row pos-right">
                    <button class="path-bubble-node node-unlocked" data-action="open-quiz" title="Chặng 2: Đấu Trường Quiz Blitz">
                        <span class="node-icon"><img src="assets/icons/badge_blitz.svg" class="node-svg" alt="Quiz Blitz"></span>
                    </button>
                    <span class="node-label">Phản Xạ 10s</span>
                </div>

                <div class="path-node-row pos-left">
                    <button class="path-chest-node" data-action="claim-chest" title="Rương phần thưởng">
                        <span class="chest-icon"><img src="assets/icons/chest.svg" class="node-svg" alt="Rương Báu"></span>
                    </button>
                    <span class="node-label">Rương Coin</span>
                </div>

                <div class="path-node-row pos-center">
                    <button class="path-bubble-node node-unlocked" data-action="open-writing" title="Chặng 3: Luyện Dịch Task 2">
                        <span class="node-icon"><img src="assets/icons/badge_writing.svg" class="node-svg" alt="Writing"></span>
                    </button>
                    <span class="node-label">Dịch Task 2</span>
                </div>

                <div class="path-node-row pos-right">
                    <button class="path-bubble-node node-trophy" data-action="open-exam" title="Chặng 4: Đề Thi Thật Cam 21">
                        <span class="node-icon"><img src="assets/icons/badge_trophy.svg" class="node-svg" alt="Cam 21"></span>
                    </button>
                    <span class="node-label">Thử Thách Cam 21</span>
                </div>
            </div>

            <!-- LOCKED NEXT UNIT -->
            <div class="path-unit-card unit-locked">
                <div class="unit-banner-head">
                    <div>
                        <span class="unit-sub">${u2 ? u2.subtitle : 'CHẶNG TIẾP THEO'}</span>
                        <h2 class="unit-title">${u2 ? u2.title : 'Nâng Cao & Luyện Phản Biện'}</h2>
                    </div>
                    <span class="unit-badge">🔒 Khóa</span>
                </div>
            </div>`;
    }

    _save() {
        localStorage.setItem('ielts_os_progression', JSON.stringify({
            unlockedNode: this.unlockedNode,
            completedNodes: this.completedNodes
        }));
    }

    isNodeUnlocked(nodeIndex) { return nodeIndex <= this.unlockedNode; }

    isTabUnlocked(viewName) {
        const req = this.tabToNode[viewName];
        return !req || this.isNodeUnlocked(req);
    }

    completeNode(nodeIndex) {
        if (nodeIndex !== this.unlockedNode) return;
        if (!this.completedNodes.includes(nodeIndex)) this.completedNodes.push(nodeIndex);
        this.unlockedNode = Math.min(5, this.unlockedNode + 1);
        this._save();
        this.renderLocks();

        window.soundManager?.playReward();
        window.mascotManager?.setEmotion('celebrate', `🎉 Chúc mừng! Mở khóa ${this.nodeNames[this.unlockedNode]}!`, 3500);

        fetch('/api/user/progress/node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: this.userId, unit_id: this.unitId, completed_node_index: nodeIndex })
        }).catch(() => {});
    }

    handleLockedNode(nodeIndex, element) {
        this._triggerFeedback(element, this.nodeNames[nodeIndex - 1] || 'bài học trước');
    }

    handleLockedTab(viewName, element) {
        const targetNode = this.tabToNode[viewName] || 2;
        this._triggerFeedback(element, this.nodeNames[targetNode - 1] || 'bài học trước');
    }

    _triggerFeedback(el, prereqName) {
        if (el) {
            el.classList.remove('duo-shake');
            void el.offsetWidth;
            el.classList.add('duo-shake');
            setTimeout(() => el?.classList.remove('duo-shake'), 500);
        }
        window.soundManager?.playLock();
        window.mascotManager?.setEmotion('clumsy', 'Bài học này đang bị khóa! Hoàn thành bài trước đã nhé!', 3000);
        this.showLockAlert(`🔒 Bài học này đang bị khóa! Bạn cần hoàn thành [${prereqName}] để mở khóa.`);
    }

    showLockAlert(msg) {
        this._ensureDrawerDOM();
        const drawer = document.getElementById('duo-lock-drawer');
        const desc = document.getElementById('lock-drawer-desc');
        if (desc) desc.textContent = msg;
        if (drawer) drawer.classList.add('active');
        clearTimeout(this.drawerTimeout);
        this.drawerTimeout = setTimeout(() => this.hideLockAlert(), 4500);
    }

    hideLockAlert() {
        document.getElementById('duo-lock-drawer')?.classList.remove('active');
    }

    renderLocks() {
        const nodeMap = [
            { index: 1, action: 'open-flashcard' },
            { index: 2, action: 'open-quiz' },
            { index: 3, action: 'claim-chest' },
            { index: 4, action: 'open-writing' },
            { index: 5, action: 'open-exam' }
        ];

        nodeMap.forEach(({ index, action }) => {
            document.querySelectorAll(`[data-action="${action}"]`).forEach(btn => {
                const unlocked = this.isNodeUnlocked(index);
                btn.classList.toggle('node-locked', !unlocked);
                let badge = btn.querySelector('.node-lock-badge');
                if (!unlocked) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'node-lock-badge';
                        badge.textContent = '🔒';
                        btn.appendChild(badge);
                    }
                } else if (badge) {
                    badge.remove();
                }
            });
        });

        Object.entries(this.tabToNode).forEach(([viewName, reqNode]) => {
            const tabBtn = document.querySelector(`.nav-tab[data-view="${viewName}"]`);
            if (tabBtn) {
                const isUnlocked = this.isNodeUnlocked(reqNode);
                tabBtn.classList.toggle('tab-locked', !isUnlocked);
                tabBtn.title = isUnlocked ? '' : `Khóa - Cần hoàn thành ${this.nodeNames[reqNode - 1]}`;
            }
        });
    }

    _ensureDrawerDOM() {
        if (document.getElementById('duo-lock-drawer')) return;
        const d = document.createElement('div');
        d.id = 'duo-lock-drawer';
        d.className = 'duo-lock-drawer';
        d.innerHTML = `
            <div class="lock-drawer-left"><span class="lock-drawer-icon">🔒</span>
                <div class="lock-drawer-text"><h4>BÀI HỌC CHƯA MỞ KHÓA</h4>
                <p id="lock-drawer-desc">Bạn cần hoàn thành bài học trước để mở khóa.</p></div>
            </div>
            <button class="btn-lock-ack" onclick="window.progressionManager.hideLockAlert()">ĐÃ HIỂU</button>`;
        document.body.appendChild(d);
    }
}

window.progressionManager = new ProgressionManager();
