/**
 * Local Store: Zero-Lockin Offline-First Storage Engine.
 * Tái tạo cơ chế lưu trữ độc lập, backup 1-click JSON, không phụ thuộc cloud hay docx.
 */
class LocalStore {
    constructor() {
        this.KEY_SCORES = "ielts_os_scores";
        this.KEY_STREAK = "ielts_os_streak";
        this.KEY_STATS = "ielts_os_stats";
        this._initStreak();
    }

    _initStreak() {
        try {
            const saved = localStorage.getItem(this.KEY_STREAK);
            const today = new Date().toISOString().split("T")[0];
            if (!saved) {
                const initial = { current: 1, best: 1, lastDate: today, totalPracticed: 0 };
                localStorage.setItem(this.KEY_STREAK, JSON.stringify(initial));
            } else {
                const streakData = JSON.parse(saved);
                const lastDate = streakData.lastDate;
                if (lastDate !== today) {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
                    if (lastDate === yesterday) {
                        streakData.current += 1;
                        if (streakData.current > streakData.best) streakData.best = streakData.current;
                    } else if (new Date(today) - new Date(lastDate) > 86400000 * 2) {
                        streakData.current = 1;
                    }
                    streakData.lastDate = today;
                    localStorage.setItem(this.KEY_STREAK, JSON.stringify(streakData));
                }
            }
        } catch (e) {
            console.warn("Streak init error:", e);
        }
    }

    getStreak() {
        try {
            const saved = localStorage.getItem(this.KEY_STREAK);
            return saved ? JSON.parse(saved) : { current: 1, best: 1, totalPracticed: 0 };
        } catch {
            return { current: 1, best: 1, totalPracticed: 0 };
        }
    }

    recordPracticeActivity(count = 1) {
        const streak = this.getStreak();
        streak.totalPracticed = (streak.totalPracticed || 0) + count;
        localStorage.setItem(this.KEY_STREAK, JSON.stringify(streak));
    }

    getScores() {
        try {
            const saved = localStorage.getItem(this.KEY_SCORES);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    }

    getWordScore(wordId, defaultScore = 1.0) {
        const scores = this.getScores();
        return scores[wordId]?.score ?? defaultScore;
    }

    setWordScore(wordId, score) {
        const scores = this.getScores();
        scores[wordId] = {
            score: Math.max(1.0, Math.min(7.0, parseFloat(score))),
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(this.KEY_SCORES, JSON.stringify(scores));
        
        // Asynchronously notify backend server
        fetch("/api/vocab/update-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: wordId, score: scores[wordId].score })
        }).catch(() => {});

        this.recordPracticeActivity(1);
    }

    getSrsDistribution(allVocab = []) {
        const scores = this.getScores();
        let needHelp = 0; // 1-2
        let progressing = 0; // 3-4
        let mastered = 0; // 5-7

        for (const w of allVocab) {
            const sc = scores[w.id]?.score ?? (w.score || 1.0);
            if (sc <= 2.0) needHelp++;
            else if (sc <= 4.0) progressing++;
            else mastered++;
        }
        return { needHelp, progressing, mastered, total: allVocab.length };
    }

    exportBackupJson() {
        const data = {
            appName: "IELTS Mastery OS",
            exportDate: new Date().toISOString(),
            scores: this.getScores(),
            streak: this.getStreak(),
            soundPrefs: JSON.parse(localStorage.getItem("ielts_os_sound_prefs") || "{}")
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().split("T")[0];
        a.href = url;
        a.download = `ielts_learning_os_backup_${dateStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importBackupJson(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed.scores) localStorage.setItem(this.KEY_SCORES, JSON.stringify(parsed.scores));
                if (parsed.streak) localStorage.setItem(this.KEY_STREAK, JSON.stringify(parsed.streak));
                if (parsed.soundPrefs) localStorage.setItem("ielts_os_sound_prefs", JSON.stringify(parsed.soundPrefs));
                if (callback) callback(true, "Khôi phục dữ liệu thành công!");
            } catch (err) {
                if (callback) callback(false, "File backup không hợp lệ: " + err.message);
            }
        };
        reader.readAsText(file);
    }
}

window.localStore = new LocalStore();
