import { getDatabase } from '../db/sqlite.js';
import { PresetLevel } from '../types/placement.types.js';
import { Course, CourseNode, CourseUnit } from '../types/course.types.js';

function createDefaultNodes(unitPrefix: string): CourseNode[] {
  return [
    {
      index: 1,
      type: 'flashcard',
      title: 'Chặng 1: Nạp Flashcard 3D',
      label: 'Nạp Từ Mục Tiêu',
      action: 'open-flashcard',
      icon: 'assets/icons/badge_flashcard.svg',
      position: 'center',
      targetCount: 15
    },
    {
      index: 2,
      type: 'quiz',
      title: 'Chặng 2: Đấu Trường Quiz Blitz',
      label: 'Phản Xạ 10s',
      action: 'open-quiz',
      icon: 'assets/icons/badge_blitz.svg',
      position: 'right',
      targetCount: 10
    },
    {
      index: 3,
      type: 'chest',
      title: 'Chặng 3: Mở Rương Coin',
      label: 'Rương Coin',
      action: 'claim-chest',
      icon: 'assets/icons/chest.svg',
      position: 'left'
    },
    {
      index: 4,
      type: 'writing',
      title: 'Chặng 4: Luyện Dịch Task 2',
      label: 'Dịch Task 2',
      action: 'open-writing',
      icon: 'assets/icons/badge_writing.svg',
      position: 'center'
    },
    {
      index: 5,
      type: 'exam',
      title: 'Chặng 5: Đề Thi Thật Cam 21',
      label: 'Thử Thách Cam 21',
      action: 'open-exam',
      icon: 'assets/icons/badge_trophy.svg',
      position: 'right'
    }
  ];
}

export const COURSES: Record<PresetLevel, Course> = {
  starter: {
    levelKey: 'starter',
    title: 'Khóa Khởi Đầu / Mất Gốc (Band 3.0 - 4.0)',
    targetBand: '3.5 - 4.0',
    description: 'Xây dựng ngữ âm IPA, 100 từ vựng sinh tồn A1-A2 cơ bản, phản xạ nghe - nói 5-10 từ/ngày.',
    vocabCount: 80,
    vocabRange: [0, 80],
    units: [
      {
        id: 'unit_st_01',
        unitNumber: 1,
        title: 'Từ Vựng Sinh Tồn A1-A2 & Ngữ Âm IPA Căn Bản',
        subtitle: 'CHẶNG 1 • STARTER FOUNDATION',
        tag: '100% Căn Bản A1-A2',
        colorTheme: 'green',
        passageId: 't1_p1',
        writingChunkId: 'chunk_01',
        nodes: createDefaultNodes('st_01')
      },
      {
        id: 'unit_st_02',
        unitNumber: 2,
        title: 'Giao Tiếp Hàng Ngày & Phản Xạ Nhận Diện Nghĩa',
        subtitle: 'CHẶNG 2 • STARTER REINFORCEMENT',
        tag: 'Củng Cố Phản Xạ',
        colorTheme: 'green',
        passageId: 't1_p1',
        writingChunkId: 'chunk_01',
        nodes: createDefaultNodes('st_02')
      }
    ]
  },
  foundation: {
    levelKey: 'foundation',
    title: 'Khóa Sơ Cấp / Nền Tảng (Band 4.5 - 5.0)',
    targetBand: '5.0 - 5.5',
    description: 'Củng cố 150 từ vựng cốt lõi B1, cấu trúc câu thông dụng và phản xạ ngữ cảnh.',
    vocabCount: 150,
    vocabRange: [0, 150],
    units: [
      {
        id: 'unit_fn_01',
        unitNumber: 1,
        title: '150 Từ Vựng Cốt Lõi B1 & Cấu Trúc Câu Ghép',
        subtitle: 'CHẶNG 1 • B1 CORE VOCAB',
        tag: 'B1 Academic Core',
        colorTheme: 'yellow',
        passageId: 't1_p1',
        writingChunkId: 'chunk_01',
        nodes: createDefaultNodes('fn_01')
      },
      {
        id: 'unit_fn_02',
        unitNumber: 2,
        title: 'Ngữ Pháp Đọc Hiểu & Kỹ Thuật Skimming Ban Đầu',
        subtitle: 'CHẶNG 2 • B1 READING BASICS',
        tag: 'Luyện Kỹ Năng Đọc',
        colorTheme: 'yellow',
        passageId: 't1_p1',
        writingChunkId: 'chunk_01',
        nodes: createDefaultNodes('fn_02')
      }
    ]
  },
  intermediate: {
    levelKey: 'intermediate',
    title: 'Khóa Trung Cấp (Band 5.5 - 6.5)',
    targetBand: '6.0 - 6.5',
    description: 'Mở rộng 300 từ AWL B2, Collocations mạnh, phân biệt sắc thái cơ bản.',
    vocabCount: 300,
    vocabRange: [50, 300],
    units: [
      {
        id: 'unit_it_01',
        unitNumber: 1,
        title: '300 Từ AWL B2 & Collocations Thực Chiến Đề Thi',
        subtitle: 'CHẶNG 1 • B2 AWL MASTERY',
        tag: 'AWL B2 Thực Chiến',
        colorTheme: 'blue',
        passageId: 't1_p1',
        writingChunkId: 'chunk_01',
        nodes: createDefaultNodes('it_01')
      },
      {
        id: 'unit_it_02',
        unitNumber: 2,
        title: 'Phân Biệt Sắc Thái Nuance & Writing Task 2 Nền',
        subtitle: 'CHẶNG 2 • B2 WRITING CHUNKS',
        tag: 'Task 2 Chunks',
        colorTheme: 'blue',
        passageId: 't1_p2',
        writingChunkId: 'chunk_02',
        nodes: createDefaultNodes('it_02')
      }
    ]
  },
  advanced: {
    levelKey: 'advanced',
    title: 'Khóa Nâng Cao (Band 7.0 - 7.5)',
    targetBand: '7.0 - 7.5',
    description: 'Master 450 từ B2-C1, giải mã bẫy Linearthinking Cam 21 và Writing Band 7.5+.',
    vocabCount: 400,
    vocabRange: [100, 450],
    units: [
      {
        id: 'unit_ad_01',
        unitNumber: 1,
        title: 'Nền Tảng Từ Vựng Học Thuật & Khảo Sát Davies Sisters',
        subtitle: 'CHẶNG 1 • CAMBRIDGE 21 C1',
        tag: 'Cam 21 Test 1 P1',
        colorTheme: 'purple',
        passageId: 't1_p1',
        writingChunkId: 'chunk_01',
        nodes: createDefaultNodes('ad_01')
      },
      {
        id: 'unit_ad_02',
        unitNumber: 2,
        title: 'Why We Need Silence & Nghệ Thuật Paraphrase Linearthinking',
        subtitle: 'CHẶNG 2 • CAMBRIDGE 21 C1',
        tag: 'Bẫy Linearthinking',
        colorTheme: 'purple',
        passageId: 't1_p2',
        writingChunkId: 'chunk_02',
        nodes: createDefaultNodes('ad_02')
      }
    ]
  },
  mastery: {
    levelKey: 'mastery',
    title: 'Khóa Xuất Sắc / Tinh Hoa (Band 8.0 - 8.5+)',
    targetBand: '8.0 - 8.5+',
    description: 'Tinh hoa C1-C2 Nuance 50 Sắc Thái, câu phức Task 2 Band 8.5+, đề thi AI Ethics.',
    vocabCount: 450,
    vocabRange: [150, 450],
    units: [
      {
        id: 'unit_ms_01',
        unitNumber: 1,
        title: 'Tinh Hoa C1-C2 Nuance 50 & Kỹ Xảo Paraphrase Đỉnh Cao',
        subtitle: 'CHẶNG 1 • C1/C2 ADVANCED NUANCE',
        tag: 'Band 8.5+ Lexicon',
        colorTheme: 'red',
        passageId: 't2_p3',
        writingChunkId: 'chunk_04',
        nodes: createDefaultNodes('ms_01')
      },
      {
        id: 'unit_ms_02',
        unitNumber: 2,
        title: 'AI Ethics & Biện Luận Phức Hợp Cambridge 21 Test 2',
        subtitle: 'CHẶNG 2 • ELITE EXAM SIMULATOR',
        tag: 'Thử Thách Cam 21 T2P3',
        colorTheme: 'red',
        passageId: 't2_p3',
        writingChunkId: 'chunk_04',
        nodes: createDefaultNodes('ms_02')
      }
    ]
  }
};

export class CourseService {
  private db = getDatabase();

  public getAllCourses(): Record<PresetLevel, Course> {
    return COURSES;
  }

  public getCourse(levelKey: PresetLevel): Course {
    return COURSES[levelKey] || COURSES.intermediate;
  }

  public getCourseForUser(userId: string = 'default_user'): { course: Course; levelKey: PresetLevel; band: string } {
    let levelKey: PresetLevel = 'intermediate';
    let band = '6.5';

    try {
      const user = this.db.prepare('SELECT target_band, starting_band FROM users WHERE id = ?').get(userId) as any;
      const stats = this.db.prepare('SELECT target_band, starting_band FROM user_stats WHERE user_id = ?').get(userId) as any;
      const targetBand = user?.target_band || stats?.target_band || '';

      if (targetBand.includes('3.5') || targetBand.includes('4.0') || targetBand.includes('3.0')) levelKey = 'starter';
      else if (targetBand.includes('5.0') || targetBand.includes('5.5') || targetBand.includes('4.5')) levelKey = 'foundation';
      else if (targetBand.includes('6.0') || targetBand.includes('6.5') || targetBand.includes('5.5')) levelKey = 'intermediate';
      else if (targetBand.includes('7.0') || targetBand.includes('7.5')) levelKey = 'advanced';
      else if (targetBand.includes('8.0') || targetBand.includes('8.5')) levelKey = 'mastery';

      band = user?.starting_band || stats?.starting_band || COURSES[levelKey].targetBand;
    } catch {
      levelKey = 'intermediate';
    }

    return { course: COURSES[levelKey], levelKey, band };
  }

  public assignCourse(userId: string, levelKey: PresetLevel): Course {
    const course = this.getCourse(levelKey);
    try {
      this.db.prepare(`
        UPDATE users
        SET target_band = ?, starting_band = ?, onboarding_completed = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(course.targetBand, course.targetBand, userId);

      this.db.prepare(`
        INSERT INTO user_stats (user_id, target_band, starting_band, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET target_band = excluded.target_band, starting_band = excluded.starting_band, updated_at = CURRENT_TIMESTAMP
      `).run(userId, course.targetBand, course.targetBand);
    } catch {
      // Non-blocking fallback
    }
    return course;
  }
}

export const courseService = new CourseService();
