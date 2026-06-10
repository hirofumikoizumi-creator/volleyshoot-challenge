import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BallState, KickEffect } from '@/lib/types/ball';

interface BallRendererProps {
  balls: BallState[];
  effects: KickEffect[];
}

/**
 * ボールとエフェクトを描画するコンポーネント
 * Skiaを使用してGPUアクセラレーション描画
 */
export const BallRenderer: React.FC<BallRendererProps> = ({ balls, effects }) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* ボール描画 */}
      {balls.map((ball) => (
        <View
          key={ball.id}
          style={[
            styles.ball,
            {
              left: ball.x - ball.radius,
              top: ball.y - ball.radius,
              width: ball.radius * 2,
              height: ball.radius * 2,
            },
          ]}
        />
      ))}

      {/* エフェクト描画 */}
      {effects.map((effect) => {
        const age = Date.now() - effect.createdAt;
        const progress = age / effect.lifetime;
        const opacity = 1 - progress;
        const scale = 1 + progress * 0.5;

        return (
          <View
            key={effect.id}
            style={[
              styles.effect,
              {
                left: effect.x - 8,
                top: effect.y - 8,
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  ball: {
    position: 'absolute',
    borderRadius: 15,
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  effect: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00FF00',
    shadowColor: '#00FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
});
