// ============================================================================
// 🎲 [GOD OF LUCK : Mythic Merge Defense - Master Data & Monetization Spec]
// ============================================================================

export type RarityType = 'COMMON' | 'RARE' | 'EPIC' | 'LEGEND' | 'MYTHIC';

export interface HeroUnitSpec {
  id: string;
  name: string;
  icon: string;
  rarity: RarityType;
  rarityLabel: string;
  color: string;
  baseAtk: number;
  atkSpeed: number;
  skillName: string;
  skillDesc: string;
  aoeRadius: number;
  slowPct?: number;
}

export const HERO_CATALOG: HeroUnitSpec[] = [
  // 1. 일반 (COMMON)
  { id: 'c_archer', name: '바람 궁수', icon: '🏹', rarity: 'COMMON', rarityLabel: '일반', color: '#94a3b8', baseAtk: 28, atkSpeed: 1.2, skillName: '연속 사격', skillDesc: '단일 표적 빠른 화살 공격', aoeRadius: 15 },
  { id: 'c_knight', name: '강철 보병', icon: '🗡️', rarity: 'COMMON', rarityLabel: '일반', color: '#94a3b8', baseAtk: 35, atkSpeed: 1.0, skillName: '강타', skillDesc: '근접한 적에게 묵직한 참격', aoeRadius: 20 },
  { id: 'c_mage', name: '견습 법사', icon: '🪄', rarity: 'COMMON', rarityLabel: '일반', color: '#94a3b8', baseAtk: 24, atkSpeed: 1.1, skillName: '비전 탄환', skillDesc: '작은 범위 마법 폭발', aoeRadius: 32 },

  // 2. 희귀 (RARE)
  { id: 'r_ice', name: '서리 마도사', icon: '🧊', rarity: 'RARE', rarityLabel: '희귀', color: '#38bdf8', baseAtk: 75, atkSpeed: 1.15, skillName: '혹한의 숨결', skillDesc: '적 이동속도 25% 둔화 및 범위 피해', aoeRadius: 45, slowPct: 0.25 },
  { id: 'r_bomber', name: '화약 폭파병', icon: '💣', rarity: 'RARE', rarityLabel: '희귀', color: '#38bdf8', baseAtk: 95, atkSpeed: 0.9, skillName: '대구경 폭탄', skillDesc: '주변 몬스터 집단 폭파', aoeRadius: 58 },
  { id: 'r_hunter', name: '황금 총잡이', icon: '🔫', rarity: 'RARE', rarityLabel: '희귀', color: '#38bdf8', baseAtk: 85, atkSpeed: 1.35, skillName: '현상금 사격', skillDesc: '처치 시 20% 확률 추가 골드 획득', aoeRadius: 22 },

  // 3. 영웅 (EPIC)
  { id: 'e_thunder', name: '뇌전 술사', icon: '⚡', rarity: 'EPIC', rarityLabel: '영웅', color: '#a855f7', baseAtk: 240, atkSpeed: 1.4, skillName: '체인 라이트닝', skillDesc: '최대 5마리 적에게 연쇄 번개 타격', aoeRadius: 72 },
  { id: 'e_flame', name: '화염 집행관', icon: '🔥', rarity: 'EPIC', rarityLabel: '영웅', color: '#a855f7', baseAtk: 280, atkSpeed: 1.2, skillName: '홍련의 불기둥', skillDesc: '넓은 지역을 불태우는 지속 화염', aoeRadius: 80 },
  { id: 'e_frost', name: '빙하 수호자', icon: '❄️', rarity: 'EPIC', rarityLabel: '영웅', color: '#a855f7', baseAtk: 210, atkSpeed: 1.25, skillName: '절대영도 충격파', skillDesc: '광역 빙결 및 이동속도 45% 감소', aoeRadius: 75, slowPct: 0.45 },

  // 4. 전설 (LEGEND)
  { id: 'l_dragon', name: '천공의 용기사', icon: '🐉', rarity: 'LEGEND', rarityLabel: '전설', color: '#f59e0b', baseAtk: 820, atkSpeed: 1.6, skillName: '드래곤 브레스', skillDesc: '트랙 전체를 가로지르는 초고열 브레스', aoeRadius: 110 },
  { id: 'l_sniper', name: '차원 저격수', icon: '🎯', rarity: 'LEGEND', rarityLabel: '전설', color: '#f59e0b', baseAtk: 1050, atkSpeed: 1.3, skillName: '헤드샷 처형', skillDesc: '보스 추가 피해 +150% 및 관통 탄환', aoeRadius: 65 },

  // 5. 신화 (MYTHIC - 조합 전용)
  { id: 'm_thor', name: '신화 : 뇌신 토르', icon: '🔨', rarity: 'MYTHIC', rarityLabel: '신화', color: '#ef4444', baseAtk: 3400, atkSpeed: 2.1, skillName: '묠니르 천벌 심판', skillDesc: '화면 전체 몬스터에게 신성 벼락 폭격', aoeRadius: 180 },
  { id: 'm_apollo', name: '신화 : 태양신 아폴론', icon: '☀️', rarity: 'MYTHIC', rarityLabel: '신화', color: '#ef4444', baseAtk: 3800, atkSpeed: 1.9, skillName: '수퍼노바 코로나', skillDesc: '태양 흑점 폭발로 트랙 전역 초토화', aoeRadius: 195 },
  { id: 'm_freya', name: '신화 : 빙결여왕 프레이야', icon: '👑', rarity: 'MYTHIC', rarityLabel: '신화', color: '#ef4444', baseAtk: 3100, atkSpeed: 2.2, skillName: '영원한 겨울 폭풍', skillDesc: '전장 전체 60% 빙결 둔화 + 얼음 창 폭격', aoeRadius: 185, slowPct: 0.6 },
  { id: 'm_hades', name: '신화 : 심연군주 하데스', icon: '💀', rarity: 'MYTHIC', rarityLabel: '신화', color: '#ef4444', baseAtk: 4200, atkSpeed: 1.8, skillName: '명계의 사신 수확', skillDesc: '체력 20% 이하 일반 몬스터 즉사 및 영혼 폭발', aoeRadius: 175 }
];

export interface MythicRecipe {
  mythicId: string;
  mythicName: string;
  icon: string;
  desc: string;
  reqHeroes: string[]; // 필요한 영웅 ID 목록
}

export const MYTHIC_RECIPES: MythicRecipe[] = [
  {
    mythicId: 'm_thor',
    mythicName: '⚡ 뇌신 토르',
    icon: '🔨',
    desc: '전체 벼락 심판 (공격 3,400)',
    reqHeroes: ['e_thunder', 'r_ice', 'c_knight']
  },
  {
    mythicId: 'm_apollo',
    mythicName: '☀️ 태양신 아폴론',
    icon: '☀️',
    desc: '태양 초신성 폭발 (공격 3,800)',
    reqHeroes: ['e_flame', 'r_bomber', 'c_archer']
  },
  {
    mythicId: 'm_freya',
    mythicName: '❄️ 빙결여왕 프레이야',
    icon: '👑',
    desc: '절대 빙결 폭풍 (공격 3,100 · 둔화 60%)',
    reqHeroes: ['e_frost', 'r_ice', 'c_mage']
  },
  {
    mythicId: 'm_hades',
    mythicName: '💀 심연군주 하데스',
    icon: '💀',
    desc: '명계 즉사 수확 (공격 4,200)',
    reqHeroes: ['l_dragon', 'r_hunter']
  }
];

export interface RoguelikeAugment {
  id: string;
  title: string;
  icon: string;
  desc: string;
  effectType: 'ATK_PCT' | 'GOLD_ON_KILL' | 'GEM_BONUS' | 'MYTHIC_BOOST';
  value: number;
}

export const ROGUELIKE_AUGMENTS: RoguelikeAugment[] = [
  { id: 'aug_1', title: '광전사의 분노 문장', icon: '⚔️', desc: '모든 아군 영웅의 최종 공격력 +45% 영구 증가', effectType: 'ATK_PCT', value: 0.45 },
  { id: 'aug_2', title: '황금 고블린의 주머니', icon: '💰', desc: '몬스터 처치 획득 골드 +50% 및 즉시 +500 골드', effectType: 'GOLD_ON_KILL', value: 0.5 },
  { id: 'aug_3', title: '운빨의 여신 축복', icon: '💎', desc: '즉시 운빨석(보석) +12개 획득 & 도박 대성공 확률 상승', effectType: 'GEM_BONUS', value: 12 },
  { id: 'aug_4', title: '신화 강림의 성배', icon: '🌟', desc: '신화 및 전설 등급 영웅의 최종 피해량 +80% 증폭', effectType: 'MYTHIC_BOOST', value: 0.8 }
];

export interface ShopProduct {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  priceKRW: string;
  priceUSD: string;
  color: string;
  perks: string[];
  diamondBonus: number;
  isVVIP?: boolean;
  isBattlePass?: boolean;
}

export const SHOP_CATALOG: ShopProduct[] = [
  {
    id: 'vvip_pass',
    badge: '👑 매출 1위 · 필수 영구 특권',
    title: '갓 오브 럭 VVIP 무광(無廣) 영구 패스',
    subtitle: '평생 모든 광고 0초 즉시 스킵 + 게임 3배속(×3.0) 해금!',
    priceKRW: '₩5,900',
    priceUSD: '$4.99',
    color: '#f59e0b',
    perks: [
      '모든 보상형 광고(도박 리롤 · 긴급 메테오 · 무료 보석) 0초 즉시 수령',
      '초고속 웨이브 돌파용 [⚡3배속 모드] 영구 해금',
      '매 판 시작 시 운빨석(보석) +15개 & 골드 +500 영구 지원'
    ],
    diamondBonus: 3000,
    isVVIP: true
  },
  {
    id: 'mythic_battlepass',
    badge: '📜 시즌 패스 · 1800% 가치',
    title: '신화 정복 시즌 패스 (시즌 1)',
    subtitle: '웨이브 돌파마다 쏟아지는 다이아와 신화 영웅 공격력 증폭',
    priceKRW: '₩11,000',
    priceUSD: '$8.99',
    color: '#10b981',
    perks: [
      '모든 영웅 기본 공격력 영구 +50% 패시브 적용',
      '즉시 +8,000 다이아 & 인게임 운빨석 +30개 지급',
      '전장 황금 네온 트랙 스킨 및 치명타 확률 +25%'
    ],
    diamondBonus: 8000,
    isBattlePass: true
  },
  {
    id: 'thor_starter_pack',
    badge: '⏰ 초회 한정 · 즉시 신화 강림',
    title: '뇌신 토르 즉시 강림 스타터 팩',
    subtitle: '조합 재료 없이 지금 즉시 전장에 [⚡신화: 뇌신 토르] 1기 배치!',
    priceKRW: '₩3,300',
    priceUSD: '$2.49',
    color: '#ec4899',
    perks: [
      '즉시 그리드에 [⚡신화: 뇌신 토르] 1기 강림 배치',
      '운빨석 +20개 & 다이아 +2,500개 즉시 지급'
    ],
    diamondBonus: 2500
  }
];