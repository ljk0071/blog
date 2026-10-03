export const SITE_URL = 'https://ssobbs13.is-a.dev';
export const SITE_TITLE = 'ssobbs13의 정원';
export const SITE_DESCRIPTION = '문제가 어떻게 발생했고 어떻게 해결했는지를 파고드는 백엔드 개발자 ssobbs13의 디지털 정원';

// Google Search Console 'URL 접두어' 속성의 HTML 태그 인증 값 (content 속성만). 비어 있으면 태그를 출력하지 않는다.
export const GOOGLE_SITE_VERIFICATION = '';

// 정원 밖, 일기를 적고 있는 포트폴리오
export const PORTFOLIO = {
  url: 'https://ssobbs13.pp.ua',
  title: '일기장 겸 포트폴리오',
  description: '개발하며 보낸 하루하루를 일기로 적고 있어요. 정원의 노트보다 조금 더 사적인 기록입니다.',
  highlights: ['일기', '회고', '포트폴리오'],
};

// 이력 요약 (소개 페이지·홈에서 사용)
export const PROFILE = {
  role: '백엔드 개발자',
  years: '3년 6개월',
  stack: ['Spring', 'JPA', 'MyBatis', 'jOOQ', 'Redis', 'PostgreSQL'],
  principles: [
    { emoji: '🔍', title: '결과보다 과정', body: '해결했다는 사실보다, 문제가 어떻게 발생했고 어떤 방식으로 해결했는지를 파고듭니다.' },
    { emoji: '🧯', title: '미리 막는 문제', body: '이미 발생한 문제뿐 아니라, 제품 속에서 발생 가능한 문제를 미리 찾아 해결합니다.' },
    { emoji: '🤝', title: '도움에 인색하지 않기', body: '협업에서 동료의 도움이 얼마나 중요한지 알기에, 저 역시 도움에 인색하지 말자고 다짐합니다.' },
  ],
  career: {
    company: '(주)대흥정보',
    title: '대리',
    period: '2022.12 – 2026.06',
    duration: '3년 6개월',
    summary: '일일 약 10만 건의 주차 데이터에 대한 요금 결제·정산 처리와, 주차 정보를 활용한 통계를 제공했습니다.',
  },
};

// 글의 성장 단계 (디지털 가든 관례)
export const STAGES = {
  seedling: { emoji: '🌱', label: '새싹', hint: '막 심은 생각. 거칠고 바뀔 수 있어요.' },
  budding: { emoji: '🌿', label: '자라는 중', hint: '어느 정도 다듬었지만 계속 자라는 중이에요.' },
  evergreen: { emoji: '🌳', label: '상록수', hint: '충분히 다듬어진 글이에요.' },
} as const;
export type Stage = keyof typeof STAGES;

// 방문 분석 (모두 공개용 식별자라 코드에 있어도 안전하다). 비어 있으면 해당 도구는 로드하지 않는다.
export const ANALYTICS = {
  ga4: 'G-SP6TNXKGLF',
  posthogKey: 'phc_xSPyVWzebkBiWCgY9tf5f4uHyjEMQLA6ZUtVUChpJnjb',
  posthogHost: 'https://us.i.posthog.com',
  clarity: 'ys0qxwdtcm',
};
