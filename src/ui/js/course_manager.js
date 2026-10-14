/**
 * IELTS Mastery OS — Adaptive Course & Pathway Manager
 * Handles 5-Tier Level Switcher & Roadmap Synchronization (< 150 lines).
 */
(function() {
    const COURSES = [
        { id: 'foundation_30', name: '🟢 Khởi Đầu / Mất Gốc (3.0 – 4.0)', band: 3.5, target: 4.0 },
        { id: 'elementary_45', name: '🟡 Sơ Cấp / Nền Tảng (4.5 – 5.0)', band: 4.5, target: 5.0 },
        { id: 'intermediate_55', name: '🔵 Trung Cấp (5.5 – 6.5)', band: 5.5, target: 6.5 },
        { id: 'advanced_70', name: '🟣 Nâng Cao (7.0 – 7.5)', band: 7.0, target: 7.5 },
        { id: 'mastery_85', name: '🔴 Xuất Sắc (8.0 – 8.5+)', band: 8.0, target: 8.5 }
    ];

    const state = {
        activeCourseId: localStorage.getItem('ielts_active_course') || 'advanced_70'
    };

    const $ = id => document.getElementById(id);

    async function switchCourse(courseId) {
        const found = COURSES.find(c => c.id === courseId);
        if (!found) return;

        state.activeCourseId = courseId;
        localStorage.setItem('ielts_active_course', courseId);

        try {
            await fetch('/api/user/course', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 'default_user', course_id: courseId })
            });
        } catch {
            // Local fallback
        }

        updateUI();
        window.soundManager?.playReward();
        window.mascotManager?.setEmotion('celebrate', `Đã chuyển sang lộ trình: ${found.name}!`, 3000);
    }

    function updateUI() {
        const course = COURSES.find(c => c.id === state.activeCourseId) || COURSES[3];
        const badge = $('user-level-badge');
        if (badge) {
            badge.textContent = `Band ${course.band}`;
        }
        const unitTitle = $('roadmap-unit-title');
        if (unitTitle) {
            unitTitle.textContent = `Cửa 1: ${course.name}`;
        }
        const select = $('course-selector-dropdown');
        if (select && select.value !== state.activeCourseId) {
            select.value = state.activeCourseId;
        }
    }

    function init() {
        updateUI();
        const select = $('course-selector-dropdown');
        if (select) {
            select.innerHTML = COURSES.map(c => 
                `<option value="${c.id}" ${c.id === state.activeCourseId ? 'selected':''}>${c.name}</option>`
            ).join('');
            select.addEventListener('change', e => switchCourse(e.target.value));
        }
    }

    window.courseManager = { init, switchCourse, getActiveCourse: () => state.activeCourseId, COURSES };
})();
