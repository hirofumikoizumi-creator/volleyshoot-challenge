import React from "react";
import { Canvas, Circle, Group, Line } from "@shopify/react-native-skia";
import type { PoseFrame, ScreenFootLandmarks, ScreenPoint } from "@/lib/pose/blazepose-types";

type FootDebugOverlayProps = {
  width: number;
  height: number;
  pose?: PoseFrame;
};

function drawFoot(foot: ScreenFootLandmarks | undefined, color: string) {
  if (!foot) return null;

  const dots: Array<{ point?: ScreenPoint; radius: number; color: string }> = [
    { point: foot.ankle, radius: 5, color },
    { point: foot.heel, radius: 5, color: "#00D9FF" },
    { point: foot.footIndex, radius: 7, color: "#A3FF12" },
    { point: foot.contactPoint, radius: 9, color: "#FFFFFF" },
  ];

  return (
    <Group>
      {foot.ankle && foot.footIndex && (
        <Line
          p1={{ x: foot.ankle.x, y: foot.ankle.y }}
          p2={{ x: foot.footIndex.x, y: foot.footIndex.y }}
          color="rgba(163,255,18,0.65)"
          strokeWidth={3}
        />
      )}
      {dots.map((dot, index) =>
        dot.point ? (
          <Circle
            key={`${foot.side}-${index}`}
            cx={dot.point.x}
            cy={dot.point.y}
            r={dot.radius}
            color={dot.color}
          />
        ) : null,
      )}
    </Group>
  );
}

export function FootDebugOverlay({ width, height, pose }: FootDebugOverlayProps) {
  return (
    <Canvas style={{ width, height, position: "absolute", left: 0, top: 0 }}>
      {drawFoot(pose?.leftFoot, "#38BDF8")}
      {drawFoot(pose?.rightFoot, "#FACC15")}
    </Canvas>
  );
}
