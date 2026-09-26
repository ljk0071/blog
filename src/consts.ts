export const SITE_TITLE = 'ssobbs13의 정원';
export const SITE_DESCRIPTION = 'React와 프론트엔드에 대해 배운 것을 조금씩 가꾸는 디지털 정원';

// Google Search Console 'URL 접두어' 속성의 HTML 태그 인증 값 (content 속성만). 비어 있으면 태그를 출력하지 않는다.
export const GOOGLE_SITE_VERIFICATION = '';

// 홈의 포트폴리오 섹션. 문구는 자유롭게 수정
export const PORTFOLIO = {
  url: 'https://ssobbs13.pp.ua',
  title: '포트폴리오',
  description: '지금까지 만든 프로젝트와 경력, 사용하는 기술 스택을 한곳에 정리했습니다.',
  highlights: ['프로젝트', '경력', '기술 스택'],
};

// 글의 성장 단계 (디지털 가든 관례)
export const STAGES = {
  seedling: { emoji: '🌱', label: '새싹', hint: '막 심은 생각. 거칠고 바뀔 수 있어요.' },
  budding: { emoji: '🌿', label: '자라는 중', hint: '어느 정도 다듬었지만 계속 자라는 중이에요.' },
  evergreen: { emoji: '🌳', label: '상록수', hint: '충분히 다듬어진 글이에요.' },
} as const;
export type Stage = keyof typeof STAGES;
