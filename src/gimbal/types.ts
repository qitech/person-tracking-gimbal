export interface GimbalState {
  pan: number; tilt: number;        // deg
  panVel: number; tiltVel: number;  // deg/s
}

export interface GimbalLimits {
  panMin: number; panMax: number; tiltMin: number; tiltMax: number;
  maxVel: number; maxAccel: number;
}

/** The only thing the controller talks to; a serial (ESP32) driver can replace the sim. */
export interface GimbalDriver {
  readonly limits: GimbalLimits;
  setVelocityCommand(pan: number, tilt: number): void; // deg/s
  getState(): GimbalState;
  update(dtSeconds: number): void; // simulation only; no-op for real hardware
  home(): void;
}
