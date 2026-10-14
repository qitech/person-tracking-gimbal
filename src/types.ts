export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
/** Pose keypoint in video-frame pixels. */
export interface Keypoint { x: number; y: number; visibility: number }
export interface AimPoints { torso: Point | null; head: Point | null }
export interface Person { keypoints: Keypoint[]; bbox: Rect; aim: AimPoints }
