# Трекінг людини з віртуальною поворотною камерою: план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Браузерне демо: камера ноутбука знаходить людину, а симульована поворотна платформа (pan/tilt) з регулятором утримує її в центрі віртуальної камери; інженерний дашборд з 3D-моделлю, графіками і панеллю керування.

**Architecture:** Чиста логіка без DOM (`geometry`, `control`, `gimbal`, `tracking`, `app/controller`) покрита тестами Vitest. Браузерний шар (`camera`, `detection/poseDetector`, `app/loop`, `ui/*`) зв'язує її з камерою, MediaPipe і відображенням. Регулятор говорить тільки з інтерфейсом `GimbalDriver`, за яким стоїть симуляція.

**Tech Stack:** TypeScript, Vite, Vitest, @mediapipe/tasks-vision (Pose Landmarker lite), three, uplot, GitHub Pages + Actions.

**Spec:** `docs/superpowers/specs/2026-10-14-person-tracking-gimbal-design.md`

## Global Constraints

- Тільки браузер, без бекенда. Основний браузер — Chrome/Edge.
- Тексти інтерфейсу і README — українською. Код, ідентифікатори, коментарі й повідомлення комітів — англійською.
- Залежності: `@mediapipe/tasks-vision`, `three`, `uplot`; dev: `typescript`, `vite`, `vitest`, `@types/three`. Інших не додавати.
- WASM MediaPipe і модель `pose_landmarker_lite.task` лежать у `public/`, ніяких запитів до сторонніх CDN під час роботи.
- `vite.config.ts`: `base: './'` (GitHub Pages у підкаталозі).
- Одиниці: кути в градусах, швидкості в °/с, час у секундах (крім `timestampMs` для MediaPipe), координати кадру в пікселях відео.
- Знаки: pan додатний праворуч, tilt додатний угору. Відео не дзеркалиться.
- Значення за замовчуванням: `physHfov` 70°, `virtHfov` 35°, мертва зона 0,7°, `maxVel` 180°/с, `maxAccel` 600°/с², затримка 0,06 с, крок симуляції 0,005 с, ворота трекера 0,15 ширини кадру, тайм-аут втрати 1,5 с, швидкість повернення 30°/с, `alpha` згладжування 0,5, поріг видимості 0,5, `numPoses` 3.
- Кожна задача закінчується `npm test` і `npx tsc --noEmit` без помилок.

## Review Focus

1. **Камера 4:3 або нестандартна роздільність** — межі pan/tilt і вікно поля зору рахуються від фактичних `videoWidth/videoHeight`, а не від 16:9. Тест: Task 2 `limits for 4:3`.
2. **Великий `dt` після повернення на вкладку** (rAF був на паузі секунди) — симуляція не робить тисячі кроків, PID не дає стрибка. Тести: Task 4 `update clamps large dt`, Task 3 `clamps dt`.
3. **Той самий кадр двічі / `dt = 0`** — PID повертає попередній вихід без ділення на нуль, `PoseDetector` не викликається з тим самим `timestampMs` (MediaPipe кидає помилку). Тест: Task 3 `dt <= 0 returns previous output`; loop пропускає кадр, якщо `video.currentTime` не змінився (Task 8).
4. **Повзунок «зуму» `virtHfov` ≥ `physHfov`** — вікно більше кадру, межі стають від'ємними. `virtHfov` обрізається до `[10, physHfov − 5]`. Тест: Task 2 `clamps virtHfov`.
5. **Відео ще не готове (`videoWidth = 0`)** — жодних NaN у стані. `createCameraModel` кидає помилку на нульові розміри, loop не будує модель і не детектує, поки розміри нульові. Тест: Task 2 `throws on zero size`.

---

## Файлова структура

```
index.html                    розмітка дашборда (варіант A)
vite.config.ts, tsconfig.json, package.json
scripts/fetch-assets.mjs      копіює WASM MediaPipe у public/wasm, завантажує модель
public/models/pose_landmarker_lite.task, public/wasm/*
src/types.ts                  Point, Rect, Keypoint, Person
src/geometry/cameraModel.ts   pinhole-модель, вікно поля зору, межі
src/control/pid.ts            PID на одну вісь
src/control/positionHold.ts   P-керування до цільового кута з обмеженням швидкості
src/control/presets.ts        пресети і конфіг PID за замовчуванням
src/gimbal/types.ts           GimbalState, GimbalLimits, GimbalDriver
src/gimbal/servoModel.ts      ServoAxis: затримка, прискорення, швидкість, межі
src/gimbal/simGimbalDriver.ts SimGimbalDriver: два ServoAxis, фіксований крок
src/detection/aimPoint.ts     ключові точки → точки наведення, рамка
src/detection/poseDetector.ts обгортка Pose Landmarker
src/tracking/targetTracker.ts машина станів цілі
src/app/state.ts              AppSettings, DEFAULT_SETTINGS, FrameSnapshot
src/app/controller.ts         вибір команди швидкості залежно від режиму і стану
src/app/loop.ts               головний цикл
src/camera/camera.ts          getUserMedia
src/ui/layout.css             стилі
src/ui/overlay.ts, virtualView.ts, gimbal3d.ts, charts.ts, controls.ts, status.ts
src/main.ts                   збирає все разом
tests/*.test.ts, tests/helpers/closedLoopSim.ts
.github/workflows/deploy.yml
README.md
```

---

### Task 1: Каркас проєкту

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/types.ts`, `scripts/fetch-assets.mjs`, `tests/smoke.test.ts`
- Create (згенеровані скриптом, комітяться): `public/wasm/*`, `public/models/pose_landmarker_lite.task`

**Interfaces:**
- Produces (`src/types.ts`):
  ```ts
  export interface Point { x: number; y: number }
  export interface Rect { x: number; y: number; w: number; h: number }
  export interface Keypoint { x: number; y: number; visibility: number } // пікселі
  export interface AimPoints { torso: Point | null; head: Point | null }
  export interface Person { keypoints: Keypoint[]; bbox: Rect; aim: AimPoints }
  ```
- Скрипти `package.json`: `dev` (vite), `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`), `fetch-assets` (`node scripts/fetch-assets.mjs`).

- [ ] **Step 1:** `npm init -y`, встановити залежності з Global Constraints. `tsconfig.json`: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `lib: [ES2022, DOM, DOM.Iterable]`, `include: [src, tests]`. `vite.config.ts` з `base: './'` і `test: { environment: 'node' }`.
- [ ] **Step 2:** `scripts/fetch-assets.mjs`: копіює `node_modules/@mediapipe/tasks-vision/wasm/*` → `public/wasm/`; завантажує `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task` → `public/models/`, якщо файлу немає. Запустити `npm run fetch-assets`. Очікується: обидва каталоги не порожні, модель ~5–6 МБ.
- [ ] **Step 3:** `src/types.ts` як вище. `index.html` з `<div id="app"></div>` і `<script type="module" src="/src/main.ts">`, `lang="uk"`, `<title>Трекінг людини: віртуальна поворотна камера</title>`. `src/main.ts` поки що виводить заголовок.
- [ ] **Step 4:** `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`. Запустити `npm test` → PASS; `npm run build` → успішно.
- [ ] **Step 5: Commit** — `chore: scaffold Vite + TS project with MediaPipe assets`

---

### Task 2: Геометрія камери

**Files:**
- Create: `src/geometry/cameraModel.ts`
- Test: `tests/cameraModel.test.ts`

**Interfaces:**
- Consumes: `Point`, `Rect`.
- Produces:
  ```ts
  export interface CameraModelParams { width: number; height: number; physHfovDeg: number; virtHfovDeg: number }
  export interface AngleLimits { panMin: number; panMax: number; tiltMin: number; tiltMax: number }
  export interface CameraModel {
    readonly width: number; readonly height: number;
    readonly f: number;            // фокусна відстань, пікселі
    readonly virtHfovDeg: number;  // після обрізання
    pixelToAngle(p: Point): { pan: number; tilt: number };
    angleToPixel(pan: number, tilt: number): Point;
    fovWindow(pan: number, tilt: number): Rect;
    limits(): AngleLimits;
  }
  export function createCameraModel(p: CameraModelParams): CameraModel;
  ```

- [ ] **Step 1: Write the failing tests**
  - `f for 1280x720 @70°`: `f ≈ 914.01` (toBeCloseTo, 1).
  - `pixel/angle round trip`: для точок `(0,0)`, `(1280,720)`, `(400,500)` `angleToPixel(pixelToAngle(p))` ≈ p (1e-6).
  - `centre is zero`: `pixelToAngle({x:640,y:360})` → `{pan:0, tilt:0}`; точка праворуч і вище центру → `pan > 0`, `tilt > 0`.
  - `limits for 16:9`: `panMax ≈ 21.052`, `tiltMax ≈ 12.217` (2 знаки), `panMin = −panMax`, `tiltMin = −tiltMax`.
  - `limits for 4:3` (640×480): `panMax ≈ 21.052`, `tiltMax ≈ 16.102`.
  - `window stays inside frame at limits`: для всіх чотирьох комбінацій граничних кутів `fovWindow` лежить у `[0,W]×[0,H]` (допуск 1e-6); розміри вікна 576.4×324.2 для 16:9 (1 знак).
  - `clamps virtHfov`: `virtHfovDeg: 80` при `physHfovDeg: 70` → `model.virtHfovDeg === 65`, `limits().panMax > 0`; `virtHfovDeg: 2` → `10`.
  - `throws on zero size`: `width: 0` → `toThrow()`.
- [ ] **Step 2:** `npm test -- cameraModel` → FAIL (модуль не існує).
- [ ] **Step 3: Implement** `createCameraModel` за формулами spec §4: `f = (W/2)/tan(physHfov/2)`; `pan = atan((x−W/2)/f)`, `tilt = −atan((y−H/2)/f)`; центр вікна `(W/2 + f·tan(pan), H/2 − f·tan(tilt))`, ширина `2f·tan(virtHfov/2)`, висота = ширина·H/W; межі `±atan((W/2 − w/2)/f)` і `±atan((H/2 − h/2)/f)`.
- [ ] **Step 4:** `npm test -- cameraModel` → PASS.
- [ ] **Step 5: Commit** — `feat(geometry): pinhole camera model with virtual FOV window`

---

### Task 3: PID і утримання позиції

**Files:**
- Create: `src/control/pid.ts`, `src/control/positionHold.ts`
- Test: `tests/pid.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PidGains { kp: number; ki: number; kd: number }
  export interface PidConfig extends PidGains {
    deadbandDeg: number; outputLimit: number; integralLimit: number;
    derivativeAlpha: number; // 0..1, EMA похідної (1 = без згладжування)
  }
  export class Pid {
    constructor(cfg: PidConfig);
    setConfig(cfg: Partial<PidConfig>): void;
    update(setpoint: number, measurement: number, dt: number): number; // °/с
    reset(): void;
  }
  // positionHold.ts
  export function velocityTowards(target: number, current: number, gain: number, maxVel: number): number;
  ```

- [ ] **Step 1: Write the failing tests** (базовий конфіг у тесті: `kp 2, ki 0, kd 0, deadbandDeg 0.7, outputLimit 100, integralLimit 20, derivativeAlpha 1`)
  - `proportional`: `update(10, 0, 0.033)` → `20`.
  - `deadband`: `update(0.5, 0, 0.033)` → `0`; `update(−0.6, 0, 0.033)` → `0`.
  - `output limit`: `kp 50`, `update(10, 0, 0.033)` → `100`.
  - `anti-windup`: `ki 5, kp 50`; 100 викликів `update(10, 0, 0.033)` у насиченні, потім `update(0, 0, 0.033)` → `|output| ≤ 1e-9 + ki·integralLimit`, і внутрішній інтеграл не перевищує `integralLimit` (експонувати `get integral(): number` для тесту).
  - `derivative on measurement`: `kp 0, kd 1`; `update(5, 0, 0.1)` потім `update(5, 1, 0.1)` → друге значення `−10` (похідна від вимірювання, без стрибка від зміни setpoint: `update(0,0,0.1)` → `update(50,0,0.1)` дає `0` за `kp 0`).
  - `dt <= 0 returns previous output`: після `update(10,0,0.033)` = 20, `update(30,0,0)` → `20`, без NaN.
  - `clamps dt`: `ki 1`, `update(10, 0, 5)` дає такий самий інтеграл, як `update(10, 0, 0.1)`.
  - `reset`: після `reset()` інтеграл 0, похідна не стрибає на першому виклику.
  - `velocityTowards`: `(10, 0, 4, 30)` → `30`; `(1, 0, 4, 30)` → `4`; `(0, 0, 4, 30)` → `0`.
- [ ] **Step 2:** `npm test -- pid` → FAIL.
- [ ] **Step 3: Implement.** `dt` обрізається до `0.1`. Мертва зона обнуляє похибку. Інтеграл накопичується лише якщо вихід не в насиченні або похибка зменшує насичення, і обрізається до `±integralLimit`. Похідна: `−(measurement − prevMeasurement)/dt`, EMA з `derivativeAlpha`. Вихід обрізається до `±outputLimit`.
- [ ] **Step 4:** `npm test -- pid` → PASS.
- [ ] **Step 5: Commit** — `feat(control): PID with deadband, anti-windup and derivative on measurement`

---

### Task 4: Модель сервоприводу і симуляційний драйвер

**Files:**
- Create: `src/gimbal/types.ts`, `src/gimbal/servoModel.ts`, `src/gimbal/simGimbalDriver.ts`
- Test: `tests/servoModel.test.ts`

**Interfaces:**
- Produces (`types.ts`): `GimbalState`, `GimbalLimits`, `GimbalDriver` — точно як у spec §3.4.
- Produces (`servoModel.ts`):
  ```ts
  export interface ServoParams { maxVel: number; maxAccel: number; delayS: number; min: number; max: number }
  export class ServoAxis {
    constructor(p: ServoParams);
    setParams(p: Partial<ServoParams>): void;
    command(vel: number): void; // штампується внутрішнім часом осі
    step(dt: number): void;
    readonly angle: number; readonly velocity: number;
    reset(angle?: number): void;
  }
  ```
- Produces (`simGimbalDriver.ts`):
  ```ts
  export const SIM_STEP_S = 0.005;
  export class SimGimbalDriver implements GimbalDriver {
    constructor(limits: GimbalLimits, delayS: number);
    setLimits(l: GimbalLimits): void;   // при зміні зуму/камери; поточні кути обрізаються
    setDelay(delayS: number): void;
  }
  ```

- [ ] **Step 1: Write the failing tests** (`maxVel 180, maxAccel 600, delayS 0.06, min −20, max 20`)
  - `delay`: `command(100)`, 11 кроків по 0.005 (0,055 с) → `velocity === 0`; ще 2 кроки → `velocity > 0`.
  - `acceleration limit`: команда 180, після 0,1 с від моменту застосування `velocity ≤ 60 + 1e-9`.
  - `velocity limit`: команда 1000, через 2 с `velocity ≤ 180`.
  - `angle limits`: команда 180 на 2 с → `angle === 20`, `velocity === 0`; команда −180 → кут рухається вниз.
  - `driver fixed step`: `update(0.0125)` тричі = той самий стан, що `update(0.0375)` (накопичувач кроків).
  - `update clamps large dt`: `update(30)` симулює не більше 0,25 с (кут після команди 100 °/с ≤ 25° і без зависання).
  - `home`: `home()` → `pan = tilt = 0`, швидкості 0.
  - `setLimits clamps`: кут 20, `setLimits` з `panMax 10` → `pan === 10`.
- [ ] **Step 2:** `npm test -- servoModel` → FAIL.
- [ ] **Step 3: Implement.** Затримка: черга `{t, vel}`; на кожному `step` застосовується останній запис з `t + delayS ≤ now`. Швидкість рухається до команди не швидше `maxAccel·dt`, обрізається до `±maxVel`; на межі кута швидкість у бік межі обнуляється. Драйвер: накопичувач `dt` (вхід обрізається до 0,25 с), кроки по `SIM_STEP_S`; `update` не робить нічого, якщо `dt ≤ 0`.
- [ ] **Step 4:** `npm test -- servoModel` → PASS.
- [ ] **Step 5: Commit** — `feat(gimbal): servo model with delay/accel/limits and fixed-step sim driver`

---

### Task 5: Точки наведення і детектор пози

**Files:**
- Create: `src/detection/aimPoint.ts`, `src/detection/poseDetector.ts`
- Test: `tests/aimPoint.test.ts`

**Interfaces:**
- Consumes: `Keypoint`, `Person`, `AimPoints`, `Point`, `Rect`.
- Produces:
  ```ts
  export type AimMode = 'torso' | 'head';
  export const VISIBILITY_THRESHOLD = 0.5;
  export function computeAim(kps: Keypoint[]): AimPoints;
  export function bboxFromKeypoints(kps: Keypoint[]): Rect;          // по видимих
  export function pickAim(aim: AimPoints, mode: AimMode): Point | null; // з відкатом на іншу
  export function toPerson(kps: Keypoint[]): Person;
  // poseDetector.ts
  export class PoseDetector {
    static create(opts: { wasmBase: string; modelUrl: string; onProgress?: (fraction: number) => void }): Promise<PoseDetector>;
    readonly delegate: 'GPU' | 'CPU';
    detect(video: HTMLVideoElement, timestampMs: number): Person[];
    close(): void;
  }
  ```

- [ ] **Step 1: Write the failing tests** (33 ключові точки, за замовчуванням невидимі; допоміжна `kp(i, x, y)` робить точку видимою)
  - `torso from shoulders and hips`: плечі (100,100), (200,100), стегна (110,300), (190,300) → torso `(150, 200)`.
  - `torso fallback without hips`: тільки плечі (100,100),(200,100) → `(150, 125)` (вниз на 0,25 ширини плечей).
  - `torso with one shoulder and one hip`: середнє видимих точок.
  - `no torso without shoulders`: тільки стегна → `torso === null`.
  - `head from nose`, `head from eyes when nose hidden`: ніс (150,50) → `(150,50)`; очі (140,45),(160,45) → `(150,45)`.
  - `pickAim fallback`: `mode 'head'`, голови немає → повертає torso; обох немає → `null`.
  - `bbox`: тільки по видимих точках.
- [ ] **Step 2:** `npm test -- aimPoint` → FAIL.
- [ ] **Step 3: Implement `aimPoint.ts`** за spec §5 (індекси: ніс 0, очі 2 і 5, плечі 11 і 12, стегна 23 і 24).
- [ ] **Step 4:** `npm test -- aimPoint` → PASS.
- [ ] **Step 5: Implement `poseDetector.ts`.** Модель завантажується через `fetch` з потоковим читанням для `onProgress` (`content-length`), передається як `modelAssetBuffer`. `FilesetResolver.forVisionTasks(wasmBase)`, `PoseLandmarker.createFromOptions` з `runningMode: 'VIDEO'`, `numPoses: 3`, `delegate: 'GPU'`; при помилці повтор з `'CPU'`. `detect` перераховує нормовані координати в пікселі `videoWidth/videoHeight` і будує `Person` через `toPerson`. Перевірка: `npx tsc --noEmit` без помилок (ручна перевірка в Task 8).
- [ ] **Step 6: Commit** — `feat(detection): aim points and MediaPipe pose detector wrapper`

---

### Task 6: Трекер цілі

**Files:**
- Create: `src/tracking/targetTracker.ts`
- Test: `tests/targetTracker.test.ts`

**Interfaces:**
- Consumes: `Person`, `Point`, `AimMode`, `pickAim`.
- Produces:
  ```ts
  export type TrackerStateName = 'searching' | 'tracking' | 'lost' | 'returning';
  export interface TrackerConfig { gateFrac: number; lostTimeoutS: number; aimMode: AimMode; smoothingAlpha: number }
  export const DEFAULT_TRACKER_CONFIG: TrackerConfig; // 0.15, 1.5, 'torso', 0.5
  export interface TrackerOutput { state: TrackerStateName; aim: Point | null; targetIndex: number | null } // aim згладжений
  export class TargetTracker {
    constructor(cfg?: Partial<TrackerConfig>);
    setConfig(cfg: Partial<TrackerConfig>): void;
    update(people: Person[], nowS: number, fovCenter: Point, frameWidth: number): TrackerOutput;
    selectAt(p: Point, people: Person[], nowS: number): boolean;
    notifyHomeReached(): void;
    reset(): void;
  }
  ```

- [ ] **Step 1: Write the failing tests** (`frameWidth 1280`, допоміжна `person(x, y)` з торсом у (x,y) і bbox 100×300 навколо)
  - `acquires person nearest FOV centre`: люди в (300,360) і (700,360), центр (640,360) → `tracking`, `targetIndex` другої.
  - `keeps target within gate`: ціль рухається на 100 px за кадр (gate 192) → лишається `tracking`, навіть якщо інша людина ближча до центру.
  - `lost when jump exceeds gate`: ціль зникла, інша людина за 400 px → `lost`, `aim === null`.
  - `reacquire within gate while lost`: у `lost` людина за 100 px від останньої позиції → `tracking`.
  - `returning after timeout`: `lost` на `nowS = 10`, `update` на `11.4` → `lost`, на `11.6` → `returning`.
  - `returning captures anyone`: у `returning` будь-яка людина → `tracking`.
  - `searching after home`: `returning` + `notifyHomeReached()` → наступний `update` без людей дає `searching`.
  - `selectAt`: клік усередині bbox іншої людини → `true`, `targetIndex` змінюється, стан `tracking`; клік повз → `false`, стан без змін.
  - `smoothing`: при `alpha 0.5` ціль стрибає з 600 у 640 (в межах воріт) → вихідний `aim.x === 620`.
- [ ] **Step 2:** `npm test -- targetTracker` → FAIL.
- [ ] **Step 3: Implement** за spec §6. Ворота рахуються від останньої сирої (не згладженої) позиції. При захопленні згладжування ініціалізується поточною точкою. `notifyHomeReached` діє тільки в `returning`.
- [ ] **Step 4:** `npm test -- targetTracker` → PASS.
- [ ] **Step 5: Commit** — `feat(tracking): target tracker state machine`

---

### Task 7: Контролер режимів і пресети (інтеграційний тест контуру)

**Files:**
- Create: `src/control/presets.ts`, `src/app/controller.ts`, `tests/helpers/closedLoopSim.ts`
- Test: `tests/controller.test.ts`, `tests/closedLoop.test.ts`

**Interfaces:**
- Consumes: `Pid`, `PidConfig`, `PidGains`, `velocityTowards`, `GimbalState`, `GimbalLimits`, `TrackerOutput`, `SimGimbalDriver`.
- Produces:
  ```ts
  // presets.ts
  export type PresetName = 'good' | 'slow' | 'oscillating';
  export const PRESETS: Record<PresetName, PidGains>;
  export const PRESET_LABELS: Record<PresetName, string>; // 'Добре налаштований' | 'Повільний' | 'Розгойдується'
  export const DEFAULT_PID_CONFIG: PidConfig; // PRESETS.good + deadbandDeg 0.7, outputLimit 180, integralLimit 20, derivativeAlpha 0.3
  // controller.ts
  export type Mode = 'auto' | 'manual';
  export const RETURN_SPEED = 30;
  export const HOME_EPS_DEG = 0.5;
  export interface ControllerInput {
    mode: Mode; dt: number; gimbal: GimbalState; limits: GimbalLimits;
    tracker: TrackerOutput;
    targetAngles: { pan: number; tilt: number } | null; // кути tracker.aim
    manual: { pan: number; tilt: number };              // цілі повзунків
    keys: { left: boolean; right: boolean; up: boolean; down: boolean };
  }
  export interface ControllerOutput { panVel: number; tiltVel: number; homeReached: boolean }
  export class Controller {
    constructor(pid: PidConfig);
    setPidConfig(cfg: Partial<PidConfig>): void;
    step(input: ControllerInput): ControllerOutput;
  }
  ```
- `tests/helpers/closedLoopSim.ts`: `simulate(opts: { gains: PidGains; target: (t: number) => number; durationS: number; detectHz?: number /*30*/ }): { t: number[]; angle: number[]; target: number[] }` — одна вісь (pan), `SimGimbalDriver` з лімітами ±21°, затримкою 0,06, `Controller` в режимі `auto` з `tracker.state = 'tracking'`; контролер викликається з частотою `detectHz`, драйвер — кроками по 1/`detectHz`. Плюс `overshoot(trace, stepSize)`, `settlingTime(trace, tolDeg)`, `rmsError(trace, fromS)`.

- [ ] **Step 1: Write the failing tests — `controller.test.ts`**
  - `auto tracking uses PID`: `targetAngles.pan = 10`, `gimbal.pan = 0` → `panVel > 0`, `tiltVel === 0` при `targetAngles.tilt = 0`.
  - `lost holds position`: `tracker.state 'lost'` → обидві швидкості `0`; те саме для `'searching'`.
  - `lost resets integral`: накопичити інтеграл у `tracking`, один крок у `lost`, потім знову `tracking` → команда дорівнює команді свіжого контролера (spec §7.2).
  - `returning goes home capped at 30`: `pan = 15`, `tilt = −5` → `panVel === −30`, `tiltVel > 0` і `≤ 30`; при `|pan|,|tilt| < 0.5` → `homeReached: true`.
  - `manual keys`: `right` → `panVel === 0.5 · limits.maxVel`; `up` → `tiltVel > 0`.
  - `manual sliders`: без клавіш, `manual.pan = 10`, `gimbal.pan = 0` → `panVel > 0`.
  - `mode switch resets integral`: накопичити інтеграл в `auto`, перейти в `manual` і назад → перша команда в `auto` дорівнює команді свіжого контролера з тими самими входами.
- [ ] **Step 2: Write the failing tests — `closedLoop.test.ts`** (критерії spec §10)
  - `good preset: 10° step`: overshoot ≤ 15%, settling (±1°) ≤ 1 с.
  - `good preset: sine 10°, 0.2 Hz`: RMS після 2 с ≤ 2°.
  - `oscillating preset: overshoot ≥ 30%`.
  - `slow preset: settling ≥ 2 s`.
- [ ] **Step 3:** `npm test -- controller closedLoop` → FAIL.
- [ ] **Step 4: Implement** `presets.ts`, `controller.ts`, хелпер. Стартові коефіцієнти: `good {kp 6, ki 1, kd 0.3}`, `slow {kp 1, ki 0, kd 0}`, `oscillating {kp 22, ki 2, kd 0}`. У `manual`: клавіші мають пріоритет над повзунками, повзунки через `velocityTowards(target, current, 4, limits.maxVel)`. `returning`: `velocityTowards(0, current, 4, RETURN_SPEED)`.
- [ ] **Step 5:** `npm test` → PASS. Якщо закритий контур не проходить — підібрати коефіцієнти (лише в `PRESETS`), не послаблюючи критерії тесту. Записати фактичні метрики в повідомлення коміту.
- [ ] **Step 6: Commit** — `feat(control): mode controller and tuned PID presets with closed-loop tests`

---

### Task 8: Головний цикл, камера, повний кадр з оверлеєм

Перший запуск у браузері: камера, скелети, рамка поля зору, замкнений контур.

**Files:**
- Create: `src/app/state.ts`, `src/app/loop.ts`, `src/camera/camera.ts`, `src/ui/overlay.ts`, `src/ui/layout.css`
- Modify: `index.html`, `src/main.ts`

**Interfaces:**
- Consumes: усе з Tasks 2–7.
- Produces:
  ```ts
  // state.ts
  export interface AppSettings {
    mode: Mode; preset: PresetName | 'custom'; pid: PidConfig;
    servo: { maxVel: number; maxAccel: number; delayS: number };
    physHfovDeg: number; virtHfovDeg: number;
    aimMode: AimMode; smoothingAlpha: number; presentation: boolean;
    manual: { pan: number; tilt: number };
  }
  export const DEFAULT_SETTINGS: AppSettings;
  export interface FrameSnapshot {
    nowS: number; frameWidth: number; frameHeight: number;
    people: Person[]; tracker: TrackerOutput; gimbal: GimbalState; limits: GimbalLimits;
    error: { pan: number; tilt: number } | null; fov: Rect; aimMode: AimMode;
    metrics: { fps: number; detectMs: number; delegate: 'GPU' | 'CPU' };
  }
  // camera.ts
  export class CameraError extends Error { readonly kind: 'denied' | 'notFound' | 'unsupported' | 'other' }
  export function startCamera(video: HTMLVideoElement): Promise<void>; // 1280x720 ideal, facingMode 'user'
  // loop.ts
  export interface App {
    start(): void; stop(): void;
    getSettings(): AppSettings; updateSettings(p: Partial<AppSettings>): void;
    selectAt(p: Point): void;          // координати кадру
    setKeys(k: ControllerInput['keys']): void;
    onFrame(cb: (s: FrameSnapshot) => void): void;
  }
  export function createApp(deps: { video: HTMLVideoElement; detector: PoseDetector }): App;
  // overlay.ts
  export class Overlay {
    constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement, onClick: (p: Point) => void);
    render(s: FrameSnapshot): void;
  }
  ```

- [ ] **Step 1:** `layout.css` + розмітка `index.html` у сітці варіанта A (spec §8): `#full` (video + canvas), `#virtual`, `#gimbal3d`, `#charts`, `#controls`, `#status`. Клас `body.presentation` ховає `#controls`. Нижче 1280px панелі складаються в одну колонку.
- [ ] **Step 2:** `camera.ts`: мапінг помилок `NotAllowedError → denied`, `NotFoundError/OverconstrainedError → notFound`, відсутність `navigator.mediaDevices` → `unsupported`.
- [ ] **Step 3:** `loop.ts` на `requestAnimationFrame`:
  1. Якщо `videoWidth === 0` — тільки чекати.
  2. Модель камери перебудовується, коли змінилися розміри відео або `physHfov/virtHfov`; тоді `driver.setLimits` з `limits()` + `servo`.
  3. Новий кадр (`video.currentTime` змінився): `detector.detect(video, performance.now())` (час детекції в `metrics.detectMs`), `tracker.update(...)` з центром `fovWindow` поточних кутів, `targetAngles = cameraModel.pixelToAngle(aim)`, у `auto` — `controller.step` → `driver.setVelocityCommand`; `homeReached` → `tracker.notifyHomeReached()`.
  4. У `manual` `controller.step` викликається щокадру анімації.
  5. Завжди: `driver.update(dt)`, зібрати `FrameSnapshot`, викликати підписників.
  `updateSettings`: зміна пресету копіює `PRESETS[preset]` у `pid`; ручна зміна kp/ki/kd ставить `preset: 'custom'`; зміна `mode` скидає PID (через контролер); `pid.outputLimit` завжди дорівнює `servo.maxVel`; `servo.maxVel/maxAccel` → `driver.setLimits`, `servo.delayS` → `driver.setDelay`; `aimMode`, `smoothingAlpha` → `tracker.setConfig`.
- [ ] **Step 4:** `overlay.ts`: canvas поверх відео у масштабі кадру; скелети (з'єднання `PoseLandmarker.POSE_CONNECTIONS`) — ціль яскравим акцентом, інші тьмяно; точка наведення; рамка `fov`; лінія від центру рамки до точки наведення. Клік перераховує координати в пікселі кадру і викликає `onClick`.
- [ ] **Step 5:** `main.ts`: `PoseDetector.create({ wasmBase: './wasm', modelUrl: './models/pose_landmarker_lite.task' })`, `startCamera`, `createApp`, `Overlay`.
- [ ] **Step 6: Manual verification** — `npm run dev`, відкрити в Chrome: видно відео і скелет; рамка поля зору плавно їде за людиною і зупиняється, коли людина в центрі; при відході з кадру рамка через ~1,5 с повертається в центр; клік по іншій людині перемикає ціль. `npm test` і `npx tsc --noEmit` → без помилок.
- [ ] **Step 7: Commit** — `feat(app): main loop, camera and full-frame overlay with closed-loop tracking`

---

### Task 9: Вигляд з камери і 3D-модель

**Files:**
- Create: `src/ui/virtualView.ts`, `src/ui/gimbal3d.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `FrameSnapshot`, `TrackerStateName`, `Mode`.
- Produces:
  ```ts
  export const STATE_LABELS: Record<TrackerStateName | 'manual', string>;
  // 'Пошук' | 'Супровід' | 'Ціль втрачено' | 'Повернення' | 'Ручний режим'
  export class VirtualView { constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement); render(s: FrameSnapshot, mode: Mode): void }
  export class Gimbal3D { constructor(container: HTMLElement); render(s: FrameSnapshot): void; resize(): void; dispose(): void }
  ```

- [ ] **Step 1:** `VirtualView`: `drawImage(video, fov.x, fov.y, fov.w, fov.h, 0, 0, W, H)`, перехрестя в центрі, бейдж стану (у `manual` — «Ручний режим», інакше `STATE_LABELS[tracker.state]`).
- [ ] **Step 2:** `Gimbal3D`: Three.js-сцена — основа (циліндр), вилка (обертання навколо Y = pan), камера (бокс, обертання навколо X = tilt), напівпрозорий конус поля зору з кутом `virtHfov`; `OrbitControls`; `ResizeObserver` на контейнер. Знаки обертання узгоджені з конвенцією (pan праворуч на екрані → камера повертається праворуч з точки зору глядача позаду платформи).
- [ ] **Step 3:** Підключити в `main.ts` через `app.onFrame`.
- [ ] **Step 4: Manual verification** — вигляд з камери тримає людину в центрі перехрестя; 3D-модель повертається в той самий бік, що й рамка; бейдж змінює стан при виході з кадру.
- [ ] **Step 5: Commit** — `feat(ui): virtual camera view and 3D gimbal model`

---

### Task 10: Графіки

**Files:**
- Create: `src/ui/charts.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `export class Charts { constructor(container: HTMLElement); push(s: FrameSnapshot): void; resize(): void }`

- [ ] **Step 1:** Два графіки uPlot: «Похибка, °» (pan, tilt, лінія нуля) і «Кути, °» (pan, tilt, пунктирні межі з `s.limits`). Кільцевий буфер останніх 10 с; перемальовка не частіше 30 разів/с. Коли `error === null`, точка похибки — розрив (`null`).
- [ ] **Step 2: Manual verification** — графіки рухаються, при пресеті «Розгойдується» (тимчасово змінити `DEFAULT_SETTINGS.preset` або через консоль `app.updateSettings`) видно коливання.
- [ ] **Step 3: Commit** — `feat(ui): real-time error and angle charts`

---

### Task 11: Панель керування і стани

**Files:**
- Create: `src/ui/controls.ts`, `src/ui/status.ts`
- Modify: `src/main.ts`, `src/ui/layout.css`

**Interfaces:**
- Consumes: `App`, `AppSettings`, `PRESET_LABELS`, `STATE_LABELS`, `FrameSnapshot`, `CameraError`.
- Produces:
  ```ts
  export class Controls { constructor(container: HTMLElement, app: App); render(s: FrameSnapshot): void }
  export type StatusKind = 'loading' | 'cameraDenied' | 'cameraNotFound' | 'unsupported' | 'error' | 'noPerson' | 'none';
  export class StatusOverlay { constructor(container: HTMLElement, onRetry: () => void); show(kind: StatusKind, progress?: number): void }
  ```

- [ ] **Step 1: `Controls`** — перемикач «Авто / Ручний»; кнопки пресетів (`PRESET_LABELS`, активний підсвічений, «Власні» при `custom`); `<details>` «Розширені налаштування»: Kp, Ki, Kd, мертва зона, макс. швидкість, прискорення, затримка (мс), поле зору віртуальної камери (10–65°), поле зору камери ноутбука (50–90°), точка наведення (торс/голова), згладжування; у ручному режимі — повзунки pan/tilt у межах `s.limits` і підказка про стрілки; показники: FPS, детекція (мс), делегат GPU/CPU, стан трекера; кнопка «Режим презентації» (перемикає `body.presentation`, `Esc` виходить). Стрілки на клавіатурі → `app.setKeys`, лише коли фокус не в полі вводу.
- [ ] **Step 2: `StatusOverlay`** — тексти:
  - `loading`: «Завантаження моделі… N%»
  - `cameraDenied`: «Немає доступу до камери. Дозвольте доступ у налаштуваннях браузера і натисніть «Спробувати ще раз».»
  - `cameraNotFound`: «Камеру не знайдено. Підключіть камеру і натисніть «Спробувати ще раз».»
  - `unsupported`: «Ваш браузер не підтримує потрібні технології. Відкрийте демо в Chrome або Edge.»
  - `error`: «Щось пішло не так. Спробуйте оновити сторінку.»
  - `noPerson` (ненав'язлива підказка на повному кадрі): «Станьте перед камерою»
- [ ] **Step 3:** `main.ts`: перевірка підтримки (`navigator.mediaDevices?.getUserMedia`, `WebAssembly`, WebGL-контекст) → `unsupported`; прогрес завантаження моделі; помилки камери → відповідний статус і повтор `startCamera` по кнопці; `noPerson`, коли `people.length === 0` понад 1 с.
- [ ] **Step 4: Manual verification** — пройти всі пресети й режими; заборонити камеру в Chrome → видно `cameraDenied`, дозволити → «Спробувати ще раз» запускає; режим презентації ховає панель; повзунок зуму 65° і 10° не ламає рамку.
- [ ] **Step 5: Commit** — `feat(ui): control panel, presentation mode and status overlays`

---

### Task 12: README і деплой

**Files:**
- Create: `README.md`, `.github/workflows/deploy.yml`

- [ ] **Step 1: `deploy.yml`** — на push у `main`: `actions/checkout`, `actions/setup-node` (Node 22, кеш npm), `npm ci`, `npm test`, `npm run build`, `actions/configure-pages`, `actions/upload-pages-artifact` (`dist`), `actions/deploy-pages`; права `pages: write`, `id-token: write`.
- [ ] **Step 2: `README.md` українською** за spec §11: що це і навіщо; посилання на демо і місце під GIF/відео; схема контуру (блок з spec §3.1); як запустити (`npm ci`, `npm run dev`, `npm test`); модулі (таблиця spec §3.2); спрощення симуляції (spec §4 і §7.1); пресети і як їх побачити; протокол для ESP32 (spec §9 дослівно); плани розвитку.
- [ ] **Step 3:** `npm run build && npm run preview` → демо працює з `dist` (відносні шляхи до `wasm/` і `models/`).
- [ ] **Step 4: Commit** — `docs: README and GitHub Pages deploy workflow`
- [ ] **Step 5 (автор, вручну):** створити репозиторій на GitHub, `git push`, увімкнути Pages (Source: GitHub Actions), перевірити посилання, записати відео-демо.
