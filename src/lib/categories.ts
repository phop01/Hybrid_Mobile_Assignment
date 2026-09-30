import type { Category } from '@/types/models';

type CategoryInfo = { label: string; color: string; soft: string; icon: 'school' | 'heart' | 'football' | 'musical-notes' };

export const CATEGORIES: Record<Category, CategoryInfo> = {
  academic: { label: 'วิชาการ', color: '#2F5BD3', soft: '#E7EDFD', icon: 'school' },
  // จิตอาสา: เดิม #15803D บนพื้น soft ได้ 4.42:1 ไม่ถึง 4.5 (ตัวอักษรเล็ก) → #146C38 ได้ 5.73:1
  volunteer: { label: 'จิตอาสา', color: '#146C38', soft: '#E3F5E9', icon: 'heart' },
  sport: { label: 'กีฬา', color: '#C2410C', soft: '#FDEDE3', icon: 'football' },
  culture: { label: 'ศิลปวัฒนธรรม', color: '#9D2C8A', soft: '#F8E6F4', icon: 'musical-notes' },
};

export const CATEGORY_ORDER: Category[] = ['academic', 'volunteer', 'sport', 'culture'];
