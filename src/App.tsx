import React, { useState, useEffect, useRef } from 'react';
import {
  HERO_CATALOG, MYTHIC_RECIPES, ROGUELIKE_AUGMENTS, SHOP_CATALOG,
  HeroUnitSpec, RarityType, RoguelikeAugment
} from './data/GodOfLuckData';

interface BoardSlot {
  slotIdx: number;
  hero: HeroUnitSpec | null;
  star: number;
}

interface TrackMonster {
  id: number;
  progress: number; // 0 ~ 4 (사각 트랙 둘레)
  hp: number;
  maxHp: number;
  isBoss: boolean;
  name: string;
  slowTimer: number;
}

interface FloatingEffect {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'spark' | 'star' | 'ring';
}

// 🎵 무의존성 WebAudio 폴리포닉 사운드 합성기
class LuckSoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playTone(freq: number, duration = 0.12, type: OscillatorType = 'sine', vol = 0.12) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {}
  }

  playClick() {
    this.playTone(800, 0.04, 'sine', 0.08);
  }

  playSummon() {
    this.playTone(523.25, 0.09, 'triangle', 0.14);
    setTimeout(() => this.playTone(659.25, 0.12, 'triangle', 0.14), 60);
  }

  playMerge() {
    [523, 659, 783, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.14, 'sine', 0.16), i * 55);
    });
  }

  playMythicJackpot() {
    [523, 659, 783, 1046, 1318, 1567].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.22, 'sawtooth', 0.15), i * 70);
    });
  }

  playGambleFail() {
    this.playTone(240, 0.18, 'sawtooth', 0.12);
    setTimeout(() => this.playTone(180, 0.25, 'sawtooth', 0.12), 120);
  }

  playHit() {
    this.playTone(180, 0.05, 'square', 0.06);
  }

  playAttack() {
    this.playTone(440, 0.06, 'sawtooth', 0.05);
  }

  playBossSpawn() {
    this.playTone(130, 0.3, 'sawtooth', 0.22);
    setTimeout(() => this.playTone(110, 0.4, 'sawtooth', 0.22), 150);
  }
}

const sfx = new LuckSoundEngine();

export default function App() {
  // 1. 영구 저장 데이터 (다이아, VVIP 패스, 배틀패스, 유물 레벨, 최고 웨이브)
  const [vvipPass, setVvipPass] = useState<boolean>(() => localStorage.getItem('gol_vvip') === '1');
  const [battlePass, setBattlePass] = useState<boolean>(() => localStorage.getItem('gol_bpass') === '1');
  const [diamonds, setDiamonds] = useState<number>(() => Number(localStorage.getItem('gol_diamonds')) || 1500);
  const [bestWave, setBestWave] = useState<number>(() => Number(localStorage.getItem('gol_bestwave')) || 1);
  const [relicAtkLv, setRelicAtkLv] = useState<number>(() => Number(localStorage.getItem('gol_relic_atk')) || 1);

  // 2. 인게임 실시간 상태
  const [wave, setWave] = useState<number>(1);
  const [gold, setGold] = useState<number>(() => (localStorage.getItem('gol_vvip') === '1' ? 800 : 300));
  const [luckGems, setLuckGems] = useState<number>(() => (localStorage.getItem('gol_vvip') === '1' ? 25 : 10));
  const [summonCost, setSummonCost] = useState<number>(40);
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [atkBuffSec, setAtkBuffSec] = useState<number>(0);

  // 5x3 (15칸) 영웅 배치 보드
  const [board, setBoard] = useState<BoardSlot[]>(() =>
    Array.from({ length: 15 }, (_, idx) => ({ slotIdx: idx, hero: null, star: 1 }))
  );
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  // 트랙 몬스터 (80마리 초과 시 위기!)
  const monstersRef = useRef<TrackMonster[]>([]);
  const effectsRef = useRef<FloatingEffect[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const [monsterCount, setMonsterCount] = useState<number>(0);
  const [bossCount, setBossCount] = useState<number>(0);

  // 로그라이크 3택 유물 모달 & 도박 실패 리롤 모달 & 광고 모달
  const [activeTab, setActiveTab] = useState<'battle' | 'gamble' | 'mythic' | 'relic' | 'shop'>('battle');
  const [augmentChoices, setAugmentChoices] = useState<RoguelikeAugment[] | null>(null);
  const [gambleRerollModal, setGambleRerollModal] = useState<{ tier: RarityType; label: string } | null>(null);
  const [adWatching, setAdWatching] = useState<{ title: string; onReward: () => void } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>("🎲 [갓 오브 럭] 하단의 [소환] 버튼을 눌러 영웅을 배치하세요!");

  // 누적 로그라이크 버프 상태
  const [augAtkBonus, setAugAtkBonus] = useState<number>(0);
  const [augGoldBonus, setAugGoldBonus] = useState<number>(0);
  const [augMythicBonus, setAugMythicBonus] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextMonsterId = useRef<number>(1);

  const MAX_MONSTER_LIMIT = 80;

  // 파티클 생성 헬퍼
  const spawnParticles = (x: number, y: number, count: number, color: string, speed = 3, shape: 'circle' | 'spark' | 'star' | 'ring' = 'circle') => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: Math.random() * 4 + 2,
        color,
        life: 0,
        maxLife: Math.floor(Math.random() * 20 + 15),
        shape
      });
    }
  };

  // 토스트 알림 헬퍼
  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  // 로컬스토리지 저장
  useEffect(() => {
    localStorage.setItem('gol_vvip', vvipPass ? '1' : '0');
    localStorage.setItem('gol_bpass', battlePass ? '1' : '0');
    localStorage.setItem('gol_diamonds', String(diamonds));
    localStorage.setItem('gol_bestwave', String(bestWave));
    localStorage.setItem('gol_relic_atk', String(relicAtkLv));
  }, [vvipPass, battlePass, diamonds, bestWave, relicAtkLv]);

  // 보상형 광고 실행기 (VVIP 보유 시 0초 즉시 수령)
  const triggerRewardedAd = (title: string, onReward: () => void) => {
    sfx.playClick();
    if (vvipPass) {
      onReward();
      sfx.playMythicJackpot();
      showToast(`👑 [VVIP 무광 특권] 광고 0초 스킵! '${title}' 보상이 즉시 지급되었습니다!`);
      return;
    }
    setAdWatching({
      title,
      onReward: () => {
        onReward();
        sfx.playMerge();
        setAdWatching(null);
        showToast(`🎁 [광고 보상 획득] '${title}' 적용 완료!`);
      }
    });
  };

  // 총합 전투력 계산
  const totalBoardPower = board.reduce((acc, s) => {
    if (!s.hero) return acc;
    const isMythicOrLegend = s.hero.rarity === 'MYTHIC' || s.hero.rarity === 'LEGEND';
    const mult =
      (1 + relicAtkLv * 0.15 + augAtkBonus + (battlePass ? 0.5 : 0)) *
      (isMythicOrLegend ? 1 + augMythicBonus : 1) *
      (vvipPass || atkBuffSec > 0 ? 2.0 : 1.0);
    return acc + Math.floor(s.hero.baseAtk * s.star * mult);
  }, 0);

  // 1. 일반 골드 소환
  const handleGoldSummon = () => {
    sfx.playClick();
    const emptySlots = board.filter((s) => s.hero === null);
    if (emptySlots.length === 0) {
      showToast("⚠️ 전장 15칸이 가득 찼습니다! [✨3성 자동 합성]을 눌러 칸을 비우세요!");
      return;
    }
    if (gold < summonCost) {
      showToast(`💰 골드가 부족합니다! (필요: ${summonCost}G / 우측 [🎬무료 보급] 활용)`);
      return;
    }

    setGold((g) => g - summonCost);
    setSummonCost((c) => Math.min(350, c + 4));

    // 확률: 일반 70%, 희귀 24%, 영웅 5%, 전설 1%
    const r = Math.random();
    let targetRarity: RarityType = 'COMMON';
    if (r > 0.99) targetRarity = 'LEGEND';
    else if (r > 0.94) targetRarity = 'EPIC';
    else if (r > 0.70) targetRarity = 'RARE';

    const pool = HERO_CATALOG.filter((h) => h.rarity === targetRarity);
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const chosenSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)].slotIdx;

    setBoard((prev) =>
      prev.map((s) => (s.slotIdx === chosenSlot ? { ...s, hero: picked, star: 1 } : s))
    );

    // Canvas 소환 파티클
    const col = chosenSlot % 5;
    const row = Math.floor(chosenSlot / 5);
    spawnParticles(68 + col * 66, 58 + row * 42, 20, picked.color, 4, 'star');

    sfx.playSummon();
    showToast(`🎲 [${picked.rarityLabel}] ${picked.icon} ${picked.name} 소환 완료!`);
  };

  // 2. 💎 운빨석 도박 소환 (고급 60% / 영웅 25% / 전설 10%)
  const handleLuckGamble = (tier: RarityType, gemCost: number, winProb: number, label: string) => {
    sfx.playClick();
    const emptySlots = board.filter((s) => s.hero === null);
    if (emptySlots.length === 0) {
      showToast("⚠️ 빈 슬롯이 없습니다! 먼저 [✨3성 자동 합성]을 수행하세요!");
      return;
    }
    if (luckGems < gemCost) {
      showToast(`💎 운빨석이 부족합니다! ([👹현상금 보스 호출] 또는 [🎬무료 보급]으로 획득)`);
      return;
    }

    setLuckGems((g) => g - gemCost);
    const success = Math.random() <= winProb;

    if (success) {
      const pool = HERO_CATALOG.filter((h) => h.rarity === tier);
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const chosenSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)].slotIdx;
      setBoard((prev) =>
        prev.map((s) => (s.slotIdx === chosenSlot ? { ...s, hero: picked, star: 1 } : s))
      );
      const col = chosenSlot % 5;
      const row = Math.floor(chosenSlot / 5);
      spawnParticles(68 + col * 66, 58 + row * 42, 35, '#fde047', 5, 'spark');
      sfx.playMythicJackpot();
      showToast(`🎰 [도박 대성공!!] ${picked.icon} [${picked.rarityLabel}] ${picked.name} 획득!!`);
    } else {
      sfx.playGambleFail();
      // 도박 실패 시 손실 회피 심리 활용 -> 광고 보고 100% 확정 소환 리롤 모달 오픈!
      setGambleRerollModal({ tier, label });
    }
  };

  // 3. ✨ 원터치 3-머지(Merge) 진화
  const handleAutoMergeAll = () => {
    sfx.playClick();
    // 같은 hero.id를 가진 슬롯이 3개 이상 있는지 탐색
    const counts: Record<string, number[]> = {};
    board.forEach((s) => {
      if (s.hero && s.hero.rarity !== 'MYTHIC') {
        if (!counts[s.hero.id]) counts[s.hero.id] = [];
        counts[s.hero.id].push(s.slotIdx);
      }
    });

    const mergeTargetId = Object.keys(counts).find((id) => counts[id].length >= 3);
    if (!mergeTargetId) {
      showToast("💡 현재 동일한 영웅 3명이 모인 그룹이 없습니다. 소환을 더 진행하세요!");
      return;
    }

    const indices = counts[mergeTargetId].slice(0, 3);
    const sourceHero = board[indices[0]].hero!;
    const nextRarityMap: Record<RarityType, RarityType> = {
      COMMON: 'RARE',
      RARE: 'EPIC',
      EPIC: 'LEGEND',
      LEGEND: 'MYTHIC',
      MYTHIC: 'MYTHIC'
    };
    const nextRarity = nextRarityMap[sourceHero.rarity];
    const nextPool = HERO_CATALOG.filter((h) => h.rarity === nextRarity);
    const evolvedHero = nextPool[Math.floor(Math.random() * nextPool.length)];

    setBoard((prev) =>
      prev.map((s) => {
        if (s.slotIdx === indices[0]) return { ...s, hero: evolvedHero, star: s.star + 1 };
        if (indices.slice(1).includes(s.slotIdx)) return { ...s, hero: null, star: 1 };
        return s;
      })
    );

    indices.forEach((idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      spawnParticles(68 + col * 66, 58 + row * 42, 25, evolvedHero.color, 4, 'ring');
    });

    sfx.playMerge();
    showToast(`✨ [3성 머지 진화!] ${sourceHero.name} 3명 ➔ ${evolvedHero.icon} [${evolvedHero.rarityLabel}] ${evolvedHero.name} 탄생!`);
  };

  // 4. 🌟 4대 신화(Mythic) 조합 가능 여부 체크 & 즉시 강림
  const checkMythicCraftable = (recipeReq: string[]): boolean => {
    const currentIds = board.filter((s) => s.hero !== null).map((s) => s.hero!.id);
    return recipeReq.every((reqId) => currentIds.includes(reqId));
  };

  const handleSummonMythic = (mythicId: string, reqHeroes: string[]) => {
    sfx.playClick();
    if (!checkMythicCraftable(recipeReqToIds(reqHeroes))) {
      showToast("⚠️ 신화 강림에 필요한 하위 재료 영웅이 아직 부족합니다!");
      return;
    }

    const mythicUnit = HERO_CATALOG.find((h) => h.id === mythicId)!;
    const usedSlots: number[] = [];

    for (const reqId of reqHeroes) {
      const found = board.find((s) => s.hero?.id === reqId && !usedSlots.includes(s.slotIdx));
      if (found) usedSlots.push(found.slotIdx);
    }

    const targetSlot = usedSlots[0];
    setBoard((prev) =>
      prev.map((s) => {
        if (s.slotIdx === targetSlot) return { ...s, hero: mythicUnit, star: 3 };
        if (usedSlots.slice(1).includes(s.slotIdx)) return { ...s, hero: null, star: 1 };
        return s;
      })
    );

    const col = targetSlot % 5;
    const row = Math.floor(targetSlot / 5);
    spawnParticles(68 + col * 66, 58 + row * 42, 50, '#ef4444', 6, 'spark');

    sfx.playMythicJackpot();
    showToast(`⚡👑 [신화 강림!!] ${mythicUnit.icon} 『${mythicUnit.name}』 전장 강림 완료!!`);
  };

  const recipeReqToIds = (reqHeroes: string[]) => reqHeroes;

  // 5. 👹 현상금 보스 즉시 호출 (언제든 클릭 시 보스 소환 -> 처치 시 보석 대량 드랍)
  const handleCallBountyBoss = () => {
    sfx.playClick();
    const bossHp = Math.floor(850 * Math.pow(1.32, Math.min(wave, 50)));
    monstersRef.current.push({
      id: nextMonsterId.current++,
      progress: 0,
      hp: bossHp,
      maxHp: bossHp,
      isBoss: true,
      name: `현상금 마왕 Lv.${wave}`,
      slowTimer: 0
    });
    sfx.playBossSpawn();
    showToast(`👹 [현상금 보스 출현!] 처치 시 💎운빨석 +6개 & 대량 골드 확정 드랍!`);
  };

  // 6. 실시간 웨이브 스폰 & 전투 루프
  useEffect(() => {
    const effectiveSpeed = vvipPass && gameSpeed === 3 ? 3 : gameSpeed;
    const intervalMs = Math.floor(220 / effectiveSpeed);

    const timer = setInterval(() => {
      // (A) 일반 몬스터 스폰
      const baseHp = Math.floor(140 * Math.pow(1.22, Math.min(wave, 60)));
      monstersRef.current.push({
        id: nextMonsterId.current++,
        progress: 0,
        hp: baseHp,
        maxHp: baseHp,
        isBoss: false,
        name: `침공 마수`,
        slowTimer: 0
      });

      // (B) 몬스터 이동 및 아군 영웅 공격
      const activeHeroes = board.filter((s) => s.hero !== null);
      const hasSlowHero = activeHeroes.some((s) => (s.hero?.slowPct || 0) > 0);

      monstersRef.current.forEach((m) => {
        const moveStep = m.isBoss ? 0.045 : 0.075;
        const slowFactor = hasSlowHero ? 0.55 : 1.0;
        m.progress = (m.progress + moveStep * slowFactor) % 4;
      });

      // 영웅 일제 사격 데미지 분배
      if (monstersRef.current.length > 0 && totalBoardPower > 0) {
        const dmgPerTick = Math.max(25, Math.floor(totalBoardPower * 0.42));
        // 보스 우선 타격, 없으면 선두 몬스터 타격
        const targetIdx = monstersRef.current.findIndex((m) => m.isBoss);
        const primaryIdx = targetIdx >= 0 ? targetIdx : 0;

        const targetMon = monstersRef.current[primaryIdx];
        targetMon.hp -= dmgPerTick;
        sfx.playHit();

        // 파티클 스파크
        const padX = 24;
        const padY = 22;
        const trackW = 450 - padX * 2;
        const trackH = 215 - padY * 2;
        const targetPos = getTrackXY(targetMon.progress, padX, padY, trackW, trackH);
        spawnParticles(targetPos.x, targetPos.y, 4, '#fbbf24', 2, 'spark');

        // 신화/영웅 광역 스플래시 피해
        const splashCount = Math.min(monstersRef.current.length, 4 + activeHeroes.length);
        for (let i = 0; i < splashCount; i++) {
          monstersRef.current[i].hp -= Math.floor(dmgPerTick * 0.48);
        }

        // 플로팅 데미지 이펙트 추가
        if (Math.random() < 0.55) {
          effectsRef.current.push({
            id: Math.random(),
            x: 80 + Math.random() * 260,
            y: 45 + Math.random() * 140,
            text: `-${dmgPerTick.toLocaleString()}`,
            color: '#fde047',
            life: 14
          });
        }
      }

      // (C) 사망 몬스터 정산
      let killedNormal = 0;
      let killedBoss = 0;
      monstersRef.current = monstersRef.current.filter((m) => {
        if (m.hp <= 0) {
          if (m.isBoss) killedBoss++;
          else killedNormal++;
          return false;
        }
        return true;
      });

      if (killedNormal > 0 || killedBoss > 0) {
        const goldGain = Math.floor(
          (killedNormal * (14 + wave * 3) + killedBoss * 220) * (1 + augGoldBonus)
        );
        setGold((g) => g + goldGain);

        if (killedBoss > 0) {
          const gemGain = killedBoss * 6;
          setLuckGems((lg) => lg + gemGain);
          setDiamonds((d) => d + killedBoss * 25);
          showToast(`🏆 [보스 격파!] 💎운빨석 +${gemGain}개 & 💰+${goldGain}G 획득!`);
        }
      }

      // (D) 80마리 초과 시 자동 긴급 정리(초보자 보호 + 위기 알림)
      if (monstersRef.current.length >= MAX_MONSTER_LIMIT) {
        monstersRef.current = monstersRef.current.slice(0, 45);
        showToast("🚨 [80마리 한계 돌파 위기!] 수호 결계가 발동하여 일부 마수를 밀어냈습니다! 영웅을 합성하세요!");
      }

      setMonsterCount(monstersRef.current.length);
      setBossCount(monstersRef.current.filter((m) => m.isBoss).length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [wave, board, totalBoardPower, gameSpeed, vvipPass, augGoldBonus]);

  // 웨이브 자동 상승 타이머 (10초마다 1웨이브 전진 & 매 5웨이브마다 보스 + 3택 로그라이크 유물)
  useEffect(() => {
    const waveTimer = setInterval(() => {
      setWave((w) => {
        const nextW = w + 1;
        if (nextW > bestWave) setBestWave(nextW);
        if (nextW % 5 === 0) {
          handleCallBountyBoss();
          setAugmentChoices(ROGUELIKE_AUGMENTS.slice(0, 3));
        }
        return nextW;
      });
    }, 10000);
    return () => clearInterval(waveTimer);
  }, [bestWave]);

  // 상단 사각 트랙 + 중앙 5x3 그리드 전장 Canvas 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let frame = 0;

    const render = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      // 1. 배경
      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, w, h);

      // 2. 외곽 사각 몬스터 행진 트랙 (Track Path)
      const padX = 24;
      const padY = 22;
      const trackW = w - padX * 2;
      const trackH = h - padY * 2;

      ctx.strokeStyle = vvipPass ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 18;
      ctx.strokeRect(padX, padY, trackW, trackH);

      // 3. 중앙 5x3 배치된 영웅들의 번개/화염 투사체 연출
      board.forEach((slot, idx) => {
        if (!slot.hero) return;
        const col = idx % 5;
        const row = Math.floor(idx / 5);
        const hx = 68 + col * 66;
        const hy = 58 + row * 42;

        // 신화 영웅 특수 화려한 오라 및 오라 파티클
        if (slot.hero.rarity === 'MYTHIC') {
          ctx.beginPath();
          ctx.arc(hx, hy, 20 + Math.sin(frame * 0.15) * 3, 0, Math.PI * 2);
          ctx.strokeStyle = slot.hero.id === 'm_thor' ? '#38bdf8' : slot.hero.id === 'm_apollo' ? '#f59e0b' : slot.hero.id === 'm_freya' ? '#a855f7' : '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // 펄싱 신화 영웅 파티클
          if (frame % 8 === 0) {
            spawnParticles(hx, hy, 2, slot.hero.color, 1.5, 'star');
          }
        }

        // 몬스터를 향한 레이저/번개 타격선
        if (monstersRef.current.length > 0 && (frame + idx * 5) % 18 < 4) {
          const target = monstersRef.current[idx % monstersRef.current.length];
          const pos = getTrackXY(target.progress, padX, padY, trackW, trackH);
          ctx.strokeStyle = slot.hero.color;
          ctx.lineWidth = slot.hero.rarity === 'MYTHIC' ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      });

      // 4. 사각 트랙 위를 행진하는 몬스터들 렌더링
      monstersRef.current.forEach((m) => {
        const pos = getTrackXY(m.progress, padX, padY, trackW, trackH);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, m.isBoss ? 15 : 9, 0, Math.PI * 2);
        ctx.fillStyle = m.isBoss ? '#ef4444' : '#a855f7';
        ctx.fill();

        ctx.font = m.isBoss ? 'bold 16px sans-serif' : '12px sans-serif';
        ctx.fillText(m.isBoss ? '👹' : '👾', pos.x - (m.isBoss ? 9 : 6), pos.y + 5);

        // 체력바
        const hpRatio = Math.max(0, m.hp / m.maxHp);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(pos.x - 12, pos.y - 16, 24, 4);
        ctx.fillStyle = m.isBoss ? '#fbbf24' : '#4ade80';
        ctx.fillRect(pos.x - 12, pos.y - 16, 24 * hpRatio, 4);
      });

      // 5. Canvas 화려한 파티클 이펙트 렌더링
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        if (p.shape === 'spark') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          ctx.font = `${Math.floor(p.size * 2.5)}px sans-serif`;
          ctx.fillText('✨', p.x, p.y);
        } else if (p.shape === 'ring') {
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + p.life * 0.2), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);

      // 6. 플로팅 데미지 텍스트
      effectsRef.current.forEach((ef) => {
        ctx.fillStyle = ef.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(ef.text, ef.x, ef.y - (14 - ef.life));
        ef.life -= 1;
      });
      effectsRef.current = effectsRef.current.filter((ef) => ef.life > 0);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [board, vvipPass]);

  // 사각 트랙 좌표 변환 헬퍼
  const getTrackXY = (prog: number, px: number, py: number, tw: number, th: number) => {
    const p = prog % 4;
    if (p < 1) return { x: px + tw * p, y: py };
    if (p < 2) return { x: px + tw, y: py + th * (p - 1) };
    if (p < 3) return { x: px + tw * (1 - (p - 2)), y: py + th };
    return { x: px, y: py + th * (1 - (p - 3)) };
  };

  // 신화 강림 가능 레시피 탐지
  const readyMythics = MYTHIC_RECIPES.filter((r) => checkMythicCraftable(r.reqHeroes));

  return (
    <div style={{
      maxWidth: '480px', margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#090d16', color: '#f8fafc', borderLeft: '1px solid #1e293b', borderRight: '1px solid #1e293b',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* 1. 상단 리소스 & 80마리 제한 게이지 헤더 */}
      <header style={{
        padding: '8px 12px', background: 'linear-gradient(90deg, #0f172a, #1e1b4b)',
        borderBottom: '1px solid #38bdf855'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 800 }}>
              WAVE {wave} (최고 {bestWave}장) {vvipPass ? '· 👑VVIP 무광' : ''}
            </span>
            <div style={{ fontSize: '14px', fontWeight: 900 }}>
              ⚔️ 총합 화력: <span style={{ color: '#38bdf8' }}>{totalBoardPower.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', lineHeight: 1.4 }}>
            <div style={{ color: '#fde047', fontWeight: 800 }}>💰 {gold.toLocaleString()} G | 💎 운빨석 {luckGems}개</div>
            <div style={{ color: '#c084fc', fontWeight: 700 }}>💠 다이아 {diamonds.toLocaleString()}</div>
          </div>
        </div>

        {/* 80마리 제한 카운터 바 (운빨존많겜 핵심 긴장감 장치!) */}
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
            <span style={{ color: monsterCount >= 55 ? '#ef4444' : '#94a3b8', fontWeight: 800 }}>
              👾 전장 몬스터 밀집도: {monsterCount} / {MAX_MONSTER_LIMIT} 마리 {bossCount > 0 ? `(👹보스 ${bossCount}기 출현중!)` : ''}
            </span>
            <span style={{ color: '#fbbf24', cursor: 'pointer', fontWeight: 800 }} onClick={() => {
              sfx.playClick();
              if (gameSpeed === 1) setGameSpeed(2);
              else if (gameSpeed === 2) {
                if (vvipPass) setGameSpeed(3);
                else {
                  showToast("👑 3배속(×3.0) 모드는 [👑VVIP 상점]에서 무광 패스 개통 시 즉시 활성화됩니다!");
                  setGameSpeed(1);
                }
              } else setGameSpeed(1);
            }}>
              ⏩ 속도 ×{gameSpeed}.0배
            </span>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (monsterCount / MAX_MONSTER_LIMIT) * 100)}%`,
              height: '100%',
              background: monsterCount >= 55 ? '#ef4444' : 'linear-gradient(90deg, #10b981, #f59e0b)',
              transition: 'width 0.2s'
            }} />
          </div>
        </div>
      </header>

      {/* 신화 강림 준비 완료 황금 알림 바 */}
      {readyMythics.length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, #991b1b, #d97706, #991b1b)', padding: '6px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fde047'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#fff' }}>
            🌟 신화 조합 재료 완성! 『{readyMythics[0].mythicName}』 강림 가능!
          </span>
          <button
            onClick={() => handleSummonMythic(readyMythics[0].mythicId, readyMythics[0].reqHeroes)}
            style={{
              padding: '4px 10px', background: '#fde047', color: '#000', fontWeight: 900,
              border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer'
            }}
          >
            ⚡ 즉시 신화 강림!
          </button>
        </div>
      )}

      {/* 2. 상단 사각 트랙 전장 Canvas + 현상금 보스 & 긴급 보급 오버레이 */}
      <section style={{ height: '215px', position: 'relative', background: '#050811', borderBottom: '1px solid #1e293b' }}>
        <canvas ref={canvasRef} width={450} height={215} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* 전장 중앙 퀵 액션 버튼 (현상금 보스 호출 & 무료 운빨 보급) */}
        <div style={{
          position: 'absolute', bottom: '8px', left: '12px', right: '12px',
          display: 'flex', justifyContent: 'space-between', gap: '6px'
        }}>
          <button
            onClick={handleCallBountyBoss}
            style={{
              padding: '5px 10px', background: 'rgba(185, 28, 28, 0.9)', color: '#fff',
              border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
            }}
          >
            👹 현상금 보스 즉시 호출 (보석+6)
          </button>
          <button
            onClick={() => triggerRewardedAd('긴급 운빨 보급 (운빨석 +12개 & 골드 +400G)', () => {
              setLuckGems((g) => g + 12);
              setGold((c) => c + 400);
            })}
            style={{
              padding: '5px 10px', background: 'rgba(2, 132, 199, 0.92)', color: '#fff',
              border: '1px solid #7dd3fc', borderRadius: '6px', fontSize: '11px', fontWeight: 800, cursor: 'pointer'
            }}
          >
            🎬 무료 운빨석+12 보급 {vvipPass ? '(즉시)' : '(광고)'}
          </button>
        </div>
      </section>

      {/* 실시간 토스트 알림줄 */}
      <div style={{
        background: '#0f172a', padding: '5px 10px', fontSize: '11px', color: '#fde047',
        borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
      }}>
        {toastMsg}
      </div>

      {/* 3. 하단 탭 컨텐츠 영역 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0b1120' }}>
        <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>

          {/* [탭 1] 전장 5x3 영웅 그리드 & 소환/3머지 컨트롤 */}
          {activeTab === 'battle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* 5x3 (15칸) 영웅 배치 타일 */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px',
                background: '#0f172a', padding: '8px', borderRadius: '10px', border: '1px solid #334155'
              }}>
                {board.map((slot) => {
                  const h = slot.hero;
                  const isSel = selectedSlot === slot.slotIdx;
                  return (
                    <div
                      key={slot.slotIdx}
                      onClick={() => {
                        sfx.playClick();
                        if (selectedSlot === null) {
                          setSelectedSlot(slot.slotIdx);
                        } else if (selectedSlot === slot.slotIdx) {
                          setSelectedSlot(null);
                        } else {
                          // 두 슬롯 위치 스왑
                          setBoard((prev) => {
                            const copy = [...prev];
                            const tempHero = copy[selectedSlot].hero;
                            const tempStar = copy[selectedSlot].star;
                            copy[selectedSlot] = { ...copy[selectedSlot], hero: copy[slot.slotIdx].hero, star: copy[slot.slotIdx].star };
                            copy[slot.slotIdx] = { ...copy[slot.slotIdx], hero: tempHero, star: tempStar };
                            return copy;
                          });
                          setSelectedSlot(null);
                        }
                      }}
                      style={{
                        height: '58px', borderRadius: '8px', cursor: 'pointer',
                        background: h ? '#1e293b' : '#090d16',
                        border: isSel ? '2px solid #fde047' : h ? `2px solid ${h.color}` : '1px dashed #334155',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        position: 'relative'
                      }}
                    >
                      {h ? (
                        <>
                          <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '9px', color: h.color, fontWeight: 800 }}>
                            {'★'.repeat(Math.min(3, slot.star))}
                          </span>
                          <div style={{ fontSize: '20px' }}>{h.icon}</div>
                          <div style={{ fontSize: '9px', fontWeight: 800, color: '#e2e8f0', marginTop: '1px', textAlign: 'center' }}>
                            {h.name.replace('신화 : ', '')}
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: '10px', color: '#475569' }}>빈 슬롯</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 하단 거대 도파민 버튼 3종: [골드 소환] / [3성 자동 합성] / [도박 소환 바로가기] */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 1fr', gap: '6px' }}>
                <button
                  onClick={handleGoldSummon}
                  style={{
                    padding: '12px 6px', borderRadius: '10px', border: '2px solid #fde047',
                    background: 'linear-gradient(180deg, #d97706, #92400e)', color: '#fff',
                    fontWeight: 900, fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  🎲 영웅 소환<br />
                  <span style={{ fontSize: '11px', color: '#fef08a' }}>({summonCost} 골드)</span>
                </button>

                <button
                  onClick={handleAutoMergeAll}
                  style={{
                    padding: '12px 6px', borderRadius: '10px', border: '2px solid #38bdf8',
                    background: 'linear-gradient(180deg, #0284c7, #075985)', color: '#fff',
                    fontWeight: 900, fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  ✨ 3성 합성 진화<br />
                  <span style={{ fontSize: '10px', color: '#bae6fd' }}>(동일 영웅 3명 합체)</span>
                </button>

                <button
                  onClick={() => {
                    sfx.playClick();
                    setActiveTab('gamble');
                  }}
                  style={{
                    padding: '12px 6px', borderRadius: '10px', border: '2px solid #c084fc',
                    background: 'linear-gradient(180deg, #7e22ce, #4c1d95)', color: '#fff',
                    fontWeight: 900, fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  🎰 운빨 도박장<br />
                  <span style={{ fontSize: '10px', color: '#e9d5ff' }}>(💎보석 {luckGems}개)</span>
                </button>
              </div>
            </div>
          )}

          {/* [탭 2] 🎰 운빨석 도박 소환 탭 (고급 60% / 영웅 25% / 전설 10%) */}
          {activeTab === 'gamble' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ padding: '8px 10px', background: '#1e1b4b', borderRadius: '8px', border: '1px solid #a855f7', fontSize: '11px' }}>
                🎰 <b>운빨 도박 소환소</b> — 💎운빨석을 걸고 상위 등급 영웅을 단번에 뽑으세요! (실패해도 <b>무료 재추첨 기회</b> 제공!)
              </div>

              {[
                { tier: 'RARE' as RarityType, title: '🧊 희귀(Rare) 영웅 확정급 도박', prob: 0.65, probText: '65%', cost: 1, color: '#38bdf8' },
                { tier: 'EPIC' as RarityType, title: '⚡ 영웅(Epic) 핵심 재료 도박', prob: 0.35, probText: '35%', cost: 2, color: '#a855f7' },
                { tier: 'LEGEND' as RarityType, title: '🐉 전설(Legend) 일발역전 잭팟 도박', prob: 0.18, probText: '18%', cost: 4, color: '#f59e0b' }
              ].map((g) => (
                <div key={g.tier} style={{
                  padding: '10px', background: '#1e293b', borderRadius: '10px',
                  borderLeft: `5px solid ${g.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: g.color }}>{g.title}</div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                      성공 확률: <b>{g.probText}</b> | 실패 시 100% 구제 리롤 지원
                    </div>
                  </div>
                  <button
                    onClick={() => handleLuckGamble(g.tier, g.cost, g.prob, g.title)}
                    style={{
                      padding: '8px 12px', background: g.color, color: '#000',
                      fontWeight: 900, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px'
                    }}
                  >
                    💎 {g.cost}개 도전
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* [탭 3] ⚡ 4대 신화(Mythic) 조합 도감 탭 */}
          {activeTab === 'mythic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#fbbf24' }}>
                ⚡ 4대 신화(Mythic) 강림 조합식 (재료 보유 시 원터치 소환!)
              </div>
              {MYTHIC_RECIPES.map((rec) => {
                const canCraft = checkMythicCraftable(rec.reqHeroes);
                return (
                  <div key={rec.mythicId} style={{
                    padding: '10px', background: '#1e293b', borderRadius: '10px',
                    border: canCraft ? '2px solid #fde047' : '1px solid #334155',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#f87171' }}>{rec.mythicName}</div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{rec.desc}</div>
                      <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '3px' }}>
                        필요 재료: {rec.reqHeroes.map((id) => HERO_CATALOG.find((h) => h.id === id)?.name).join(' + ')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSummonMythic(rec.mythicId, rec.reqHeroes)}
                      style={{
                        padding: '8px 10px', borderRadius: '8px', border: 'none',
                        background: canCraft ? '#fde047' : '#334155',
                        color: canCraft ? '#000' : '#94a3b8', fontWeight: 900, fontSize: '11px', cursor: 'pointer'
                      }}
                    >
                      {canCraft ? '⚡ 즉시 강림!' : '재료 수집중'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* [탭 4] 🏺 영구 신화 유물 강화 탭 */}
          {activeTab === 'relic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ padding: '10px', background: '#1e293b', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#fbbf24' }}>🗡️ 태고 신들의 검집 (Lv.{relicAtkLv})</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>모든 영웅 최종 공격력 영구 +{(relicAtkLv * 15)}%</div>
                </div>
                <button
                  onClick={() => {
                    sfx.playClick();
                    const cost = relicAtkLv * 250;
                    if (diamonds >= cost) {
                      setDiamonds((d) => d - cost);
                      setRelicAtkLv((l) => l + 1);
                      sfx.playMerge();
                      showToast(`🏺 신화 유물 Lv.${relicAtkLv + 1} 돌파! 전체 공격력 영구 상승!`);
                    } else {
                      showToast("💠 다이아가 부족합니다! (보스 처치 또는 상점에서 획득)");
                    }
                  }}
                  style={{ padding: '8px 12px', background: '#f59e0b', color: '#000', fontWeight: 900, border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
                >
                  강화 ({relicAtkLv * 250} 다이아)
                </button>
              </div>
            </div>
          )}

          {/* [탭 5] 👑 VVIP 수익화 상점 탭 */}
          {activeTab === 'shop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SHOP_CATALOG.map((item) => {
                const owned = (item.isVVIP && vvipPass) || (item.isBattlePass && battlePass);
                return (
                  <div key={item.id} style={{
                    padding: '10px', background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    borderRadius: '10px', border: `1px solid ${item.color}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', background: item.color, color: '#000', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                        {item.badge}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#fde047' }}>{item.priceKRW} ({item.priceUSD})</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '4px' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>{item.subtitle}</div>
                    <ul style={{ margin: '0 0 8px 16px', padding: 0, fontSize: '10px', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {item.perks.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                    <button
                      disabled={owned}
                      onClick={() => {
                        sfx.playClick();
                        if (item.isVVIP) {
                          setVvipPass(true);
                          setGameSpeed(3);
                        }
                        if (item.isBattlePass) setBattlePass(true);
                        if (item.id === 'thor_starter_pack') {
                          const thor = HERO_CATALOG.find((h) => h.id === 'm_thor')!;
                          setBoard((prev) => prev.map((s, idx) => (idx === 0 ? { ...s, hero: thor, star: 3 } : s)));
                        }
                        setDiamonds((d) => d + item.diamondBonus);
                        setLuckGems((g) => g + 20);
                        sfx.playMythicJackpot();
                        showToast(`👑 [${item.title}] 개통 완료! 특권 및 다이아 +${item.diamondBonus.toLocaleString()} 즉시 지급!`);
                      }}
                      style={{
                        width: '100%', padding: '8px', borderRadius: '6px', border: 'none',
                        background: owned ? '#475569' : item.color,
                        color: owned ? '#94a3b8' : '#000', fontWeight: 900, fontSize: '12px', cursor: owned ? 'default' : 'pointer'
                      }}
                    >
                      {owned ? '✅ 영구 특권 활성화됨' : `⚡ 즉시 개통 테스트 (${item.priceKRW})`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* 하단 5대 네비게이션 독(Dock) */}
        <nav style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', background: '#060913',
          borderTop: '1px solid #1e293b', padding: '5px 4px'
        }}>
          {[
            { id: 'battle', label: '🎲전장·소환' },
            { id: 'gamble', label: '🎰운빨도박' },
            { id: 'mythic', label: '⚡신화강림' },
            { id: 'relic', label: '🏺신화유물' },
            { id: 'shop', label: '👑VVIP상점' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                sfx.playClick();
                setActiveTab(t.id as typeof activeTab);
              }}
              style={{
                background: activeTab === t.id ? '#1e293b' : 'transparent',
                color: activeTab === t.id ? '#fde047' : '#94a3b8',
                border: 'none', borderRadius: '6px', padding: '7px 2px',
                fontSize: '11px', fontWeight: 800, cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </main>

      {/* 🎰 도박 실패 시 손실 회피 심리 활용 -> 100% 확정 소환 리롤(광고) 모달 */}
      {gambleRerollModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '20px'
        }}>
          <div style={{
            background: '#1e1b4b', border: '2px solid #f59e0b', borderRadius: '12px',
            padding: '20px', maxWidth: '350px', width: '100%', textAlign: 'center'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#fbbf24', marginBottom: '6px' }}>
              🎰 아깝습니다! 도박 소환이 빗나갔습니다!
            </div>
            <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
              포기하지 마세요! <b>운명의 재추첨</b>을 발동하면<br />
              <span style={{ color: '#fde047', fontWeight: 800 }}>100% 확률로 [{gambleRerollModal.label}]</span> 영웅이 즉시 소환됩니다!
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => {
                  sfx.playClick();
                  setGambleRerollModal(null);
                }}
                style={{ padding: '10px', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                포기하기
              </button>
              <button
                onClick={() => {
                  sfx.playClick();
                  const targetTier = gambleRerollModal.tier;
                  setGambleRerollModal(null);
                  triggerRewardedAd('도박 실패 100% 확정 소환 리롤', () => {
                    const emptySlots = board.filter((s) => s.hero === null);
                    if (emptySlots.length > 0) {
                      const pool = HERO_CATALOG.filter((h) => h.rarity === targetTier);
                      const picked = pool[Math.floor(Math.random() * pool.length)];
                      const chosenSlot = emptySlots[0].slotIdx;
                      setBoard((prev) => prev.map((s) => (s.slotIdx === chosenSlot ? { ...s, hero: picked, star: 1 } : s)));
                      const col = chosenSlot % 5;
                      const row = Math.floor(chosenSlot / 5);
                      spawnParticles(68 + col * 66, 58 + row * 42, 30, picked.color, 4, 'star');
                    }
                  });
                }}
                style={{ padding: '10px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 900, cursor: 'pointer' }}
              >
                🎬 100% 확정 소환 {vvipPass ? '(즉시)' : '(광고)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 매 5웨이브 돌파 시 로그라이크 3택 신화 유물 선택 모달 */}
      {augmentChoices && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 115, padding: '20px'
        }}>
          <div style={{
            background: '#0f172a', border: '2px solid #38bdf8', borderRadius: '12px',
            padding: '18px', maxWidth: '370px', width: '100%'
          }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#38bdf8', textAlign: 'center', marginBottom: '10px' }}>
              🌟 [웨이브 돌파 보너스] 신들의 축복 3택 1
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {augmentChoices.map((aug) => (
                <button
                  key={aug.id}
                  onClick={() => {
                    sfx.playClick();
                    if (aug.effectType === 'ATK_PCT') setAugAtkBonus((a) => a + aug.value);
                    if (aug.effectType === 'GOLD_ON_KILL') { setAugGoldBonus((g) => g + aug.value); setGold((c) => c + 500); }
                    if (aug.effectType === 'GEM_BONUS') setLuckGems((lg) => lg + aug.value);
                    if (aug.effectType === 'MYTHIC_BOOST') setAugMythicBonus((m) => m + aug.value);
                    sfx.playMythicJackpot();
                    setAugmentChoices(null);
                    showToast(`🌟 [${aug.title}] 축복 활성화 완료!`);
                  }}
                  style={{
                    padding: '10px', background: '#1e293b', border: '1px solid #38bdf8',
                    borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#fde047' }}>{aug.icon} {aug.title}</div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>{aug.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🎬 보상형 광고 시청 시뮬레이션 모달 */}
      {adWatching && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 130, padding: '20px'
        }}>
          <div style={{
            background: '#1e293b', border: '2px solid #38bdf8', borderRadius: '12px',
            padding: '20px', maxWidth: '340px', width: '100%', textAlign: 'center'
          }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#38bdf8', marginBottom: '8px' }}>
              🎬 [AdMob 보상형 광고] {adWatching.title}
            </div>
            <p style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
              안드로이드 스토어 출시 시 실제 AdMob 광고가 송출됩니다.<br />
              (👑 <b>VVIP 무광 패스</b> 개통 시 이 창 없이 0초 즉시 수령!)
            </p>
            <button
              onClick={() => {
                sfx.playClick();
                adWatching.onReward();
              }}
              style={{
                width: '100%', marginTop: '10px', padding: '10px', background: '#fde047',
                color: '#000', fontWeight: 900, border: 'none', borderRadius: '8px', cursor: 'pointer'
              }}
            >
              ⚡ 보상 즉시 수령하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}