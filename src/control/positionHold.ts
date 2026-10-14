/** P-control towards a target angle, limited to maxVel (deg/s). */
export function velocityTowards(target: number, current: number, gain: number, maxVel: number): number {
  const v = gain * (target - current);
  return Math.max(-maxVel, Math.min(maxVel, v)) + 0; // + 0 normalises -0
}
