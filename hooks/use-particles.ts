import { useRef, useState, useEffect } from 'react';

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0-1 (1=新規, 0=消滅)
  size: number;
  color: string;
}

/**
 * パーティクルエフェクト管理フック
 * ボール消滅時のエフェクト、キック成功時のアニメーションを管理
 */
export function useParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // パーティクルアニメーションループ
  useEffect(() => {
    animationRef.current = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.1, // 重力
            life: p.life - 0.02,
          }))
          .filter((p) => p.life > 0)
      );
    }, 30);

    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  const createBallBurstEffect = (x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 3 + Math.random() * 2;

      newParticles.push({
        id: `particle-${particleIdRef.current++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // 上向きバイアス
        life: 1,
        size: 4 + Math.random() * 2,
        color,
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
  };

  const createKickSuccessEffect = (x: number, y: number) => {
    const newParticles: Particle[] = [];

    // 星形パーティクル
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 4;

      newParticles.push({
        id: `particle-${particleIdRef.current++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 3,
        color: '#FFD700', // ゴールド
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
  };

  const createComboEffect = (x: number, y: number, comboCount: number) => {
    const newParticles: Particle[] = [];

    // コンボ数に応じてパーティクル数を増加
    const particleCount = Math.min(comboCount, 20);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;

      newParticles.push({
        id: `particle-${particleIdRef.current++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        size: 2 + Math.random() * 2,
        color: comboCount > 5 ? '#FF6B6B' : '#00D9FF', // コンボが多いと赤
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
  };

  const clearParticles = () => {
    setParticles([]);
  };

  return {
    particles,
    createBallBurstEffect,
    createKickSuccessEffect,
    createComboEffect,
    clearParticles,
  };
}
