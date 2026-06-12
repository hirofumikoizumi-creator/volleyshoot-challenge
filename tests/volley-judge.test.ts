import { describe, expect, it } from "vitest";
import type { ScreenFootLandmarks } from "../lib/pose/blazepose-types";
import { judgeVolleyHit, type VolleyBallEntity } from "../lib/pose/volley-judge";

function foot(overrides: Partial<ScreenFootLandmarks> = {}): ScreenFootLandmarks {
  return {
    side: "right",
    ankle: { x: 80, y: 100, visibility: 0.9 },
    heel: { x: 100, y: 100, visibility: 0.9 },
    footIndex: { x: 130, y: 100, visibility: 0.9 },
    contactPoint: { x: 122, y: 100, visibility: 0.9 },
    velocity: { x: 0.26, y: 0, speed: 0.26 },
    normalizedSpeed: 2.6,
    confidence: 0.9,
    stableFrames: 5,
    timestampMs: 1000,
    ...overrides,
  };
}

function ball(overrides: Partial<VolleyBallEntity> = {}): VolleyBallEntity {
  return {
    id: 1,
    x: 150,
    y: 100,
    radius: 18,
    targetTimeMs: 1000,
    ...overrides,
  };
}

describe("judgeVolleyHit", () => {
  it("rejects a stationary foot even when overlapping the ball", () => {
    const result = judgeVolleyHit(
      foot({ velocity: { x: 0.02, y: 0, speed: 0.02 }, normalizedSpeed: 0.2 }),
      ball(),
      1000,
      170,
    );

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("speed");
  });

  it("accepts a fast foot that approaches the ball inside the timing window", () => {
    const result = judgeVolleyHit(foot(), ball(), 1018, 170);

    expect(result.hit).toBe(true);
    expect(result.grade).toBe("PERFECT");
  });

  it("rejects movement away from the ball", () => {
    const result = judgeVolleyHit(
      foot({ velocity: { x: -0.26, y: 0, speed: 0.26 } }),
      ball(),
      1000,
      170,
    );

    expect(result.hit).toBe(false);
    expect(result.reason).toBe("direction");
  });

  it("grades timing from the ball arrival time", () => {
    expect(judgeVolleyHit(foot(), ball(), 1048, 170).grade).toBe("PERFECT");
    expect(judgeVolleyHit(foot(), ball(), 1090, 170).grade).toBe("GOOD");
    expect(judgeVolleyHit(foot(), ball(), 1140, 170).grade).toBe("OK");
  });
});
