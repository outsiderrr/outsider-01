# 里程碑 1：动作模型 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：**建好项目骨架，把正手动作模型从原型迁移成带测试的 TypeScript 模块，新建双手反手三种站位，并做一个 2D 检查台页面用来目视校对动作。

**架构：**`src/model/` 是纯函数模块（关键帧数据 → 插值 → IK 求解 → 派生指标），不依赖页面；`src/render2d/` 把求解结果画成 SVG（之后用作 3D 的降级版本）；`dev/viewer.html` 是开发用检查台，不进正式构建。

**技术栈：**Vite 7、TypeScript 5、Vitest 3（版本以安装时的最新稳定版为准）。

**范围说明：**这是 6 个里程碑里的第 1 个。后面 5 个（3D 渲染与实验室、章节与内容、打磨、品质循环、发布）各自在开始前单独写计划，因为它们要建立在本里程碑实际写出的代码之上。

**依据：**`docs/superpowers/specs/2026-10-02-outsider-01-design.md` 第 5 节；正手初始数据来自 `reference/prototype-forehand.html`。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `package.json`、`tsconfig.json`、`vite.config.ts` | 项目配置；Vitest 配置写在 vite.config.ts 里 |
| `index.html`、`src/main.ts` | 正式站点入口（本里程碑只是占位） |
| `src/model/vec.ts` | 三维向量运算 |
| `src/model/types.ts` | 类型：击球、站位、阶段、关键帧、姿态 |
| `src/model/body.ts` | 人体与器材尺寸、关键帧时间 |
| `src/model/keyframes/forehand.ts` | 正手三种站位的关键帧（含共用的准备姿势） |
| `src/model/keyframes/backhand.ts` | 双手反手三种站位的关键帧（由正手镜像加调整得到） |
| `src/model/mirror.ts` | 关键帧左右镜像 |
| `src/model/interp.ts` | 关键帧插值：任意时刻的姿态 |
| `src/model/solve.ts` | 姿态 → 关节坐标（IK、脚、球拍几何） |
| `src/model/metrics.ts` | 派生指标：肩髋差、拍头速度、发力链曲线 |
| `src/model/index.ts` | 对外接口 |
| `src/render2d/project.ts` | 2D 相机投影 |
| `src/render2d/stickFigure.ts` | 把一帧姿态画成 SVG |
| `dev/viewer.html`、`src/dev/viewer.ts` | 开发用检查台 |
| `tests/*.test.ts` | 单元测试与模型约束测试 |

---

### Task 1：建分支和项目骨架

**Files:**
- Create: `package.json`、`tsconfig.json`、`vite.config.ts`、`index.html`、`src/main.ts`

- [ ] **Step 1：建开发分支**

```bash
cd /Users/outsider/通用空间/outsider-01 && git checkout -b m1-model
```

- [ ] **Step 2：初始化 npm 并安装开发依赖**

```bash
npm init -y >/dev/null && npm pkg set name=outsider-01 private=true version=0.1.0 type=module \
  scripts.dev="vite" scripts.build="tsc --noEmit && vite build" scripts.preview="vite preview" \
  scripts.test="vitest run" scripts.typecheck="tsc --noEmit" && npm pkg delete main keywords author license description \
  && npm install -D vite typescript vitest
```

Expected：安装成功，`package.json` 里出现 `devDependencies`。

- [ ] **Step 3：写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests", "dev", "vite.config.ts"]
}
```

- [ ] **Step 4：写 vite.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/outsider-01/' : '/',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 5：写占位入口**

`index.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>网球挥拍实验报告</title>
  </head>
  <body>
    <main>
      <h1>网球挥拍实验报告</h1>
      <p>建设中。</p>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`：

```ts
export {};
```

- [ ] **Step 6：验证骨架可用**

Run: `npx tsc --noEmit && npx vitest run --passWithNoTests && npx vite build`
Expected：三条命令都成功，生成 `dist/`。

- [ ] **Step 7：提交**

```bash
git add -A && git commit -m "搭项目骨架：Vite + TypeScript + Vitest"
```

---

### Task 2：向量工具

**Files:**
- Create: `src/model/vec.ts`
- Test: `tests/vec.test.ts`

- [ ] **Step 1：写失败的测试** `tests/vec.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { add, angleBetween, azimuth, cross, dist, dot, length, normalize, scale, sub } from '../src/model/vec';

describe('vec', () => {
  it('基本运算', () => {
    expect(add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(scale([1, -2, 3], 2)).toEqual([2, -4, 6]);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(length([3, 4, 0])).toBe(5);
    expect(dist([0, 0, 0], [0, 3, 4])).toBe(5);
  });

  it('normalize 遇到零向量返回零向量', () => {
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
    expect(normalize([0, 0, 2])[2]).toBeCloseTo(1);
  });

  it('angleBetween 返回度数', () => {
    expect(angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(90);
    expect(angleBetween([1, 0, 0], [2, 0, 0])).toBeCloseTo(0);
  });

  it('azimuth：0° 朝网，90° 朝右', () => {
    const a = azimuth(0);
    expect(a[0]).toBeCloseTo(0);
    expect(a[1]).toBeCloseTo(1);
    const b = azimuth(90);
    expect(b[0]).toBeCloseTo(1);
    expect(b[1]).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2：运行，确认失败**

Run: `npx vitest run tests/vec.test.ts`
Expected：FAIL，提示找不到 `../src/model/vec`。

- [ ] **Step 3：实现** `src/model/vec.ts`

```ts
export type Vec3 = readonly [number, number, number];

export const DEG = Math.PI / 180;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: Vec3, b: Vec3): number => length(sub(a, b));
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l === 0 ? [0, 0, 0] : scale(a, 1 / l);
};
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => add(scale(a, 1 - t), scale(b, t));

/** 两个向量的夹角（度） */
export const angleBetween = (a: Vec3, b: Vec3): number => {
  const la = length(a);
  const lb = length(b);
  if (la === 0 || lb === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb)))) / DEG;
};

/** 水平方位角（度）转单位向量：0° 指向球网（+y），90° 指向球员右侧（+x） */
export const azimuth = (deg: number): Vec3 => [Math.sin(deg * DEG), Math.cos(deg * DEG), 0];
```

- [ ] **Step 4：运行，确认通过**

Run: `npx vitest run tests/vec.test.ts`
Expected：PASS（4 个用例）。

- [ ] **Step 5：提交**

```bash
git add -A && git commit -m "模型：三维向量工具"
```

---

### Task 3：类型、尺寸常量、正手关键帧

**Files:**
- Create: `src/model/types.ts`、`src/model/body.ts`、`src/model/keyframes/forehand.ts`

正手关键帧来自原型，但第 3 帧（蹬地转髋）的骨盆朝向按"发力链"实验做了调整：中性 40→15、半开放 22→3、开放 15→−3。这样骨盆先转到位，躯干、手臂、拍头再依次达到最快（实验数据见第 7 任务的预期）。

- [ ] **Step 1：写** `src/model/types.ts`

```ts
import type { Vec3 } from './vec';

export type Stroke = 'forehand' | 'backhand';
export type Stance = 'neutral' | 'semi' | 'open';
export type PhaseId = 'ready' | 'backswing' | 'drive' | 'contact' | 'finish';

export const STROKES: readonly Stroke[] = ['forehand', 'backhand'];
export const STANCES: readonly Stance[] = ['neutral', 'semi', 'open'];
export const PHASES: readonly PhaseId[] = ['ready', 'backswing', 'drive', 'contact', 'finish'];

/** 脚：[x, y, 朝向角°, 脚跟抬起 0..1] */
export type Foot = readonly [number, number, number, number];
/** 柱坐标（绕骨盆竖轴）：[方位角°, 水平半径, 高度] */
export type Cyl = readonly [number, number, number];
/** 发力标记：[腿, 髋, 躯干, 手臂, 球拍]，0..1 */
export type Activation = readonly [number, number, number, number, number];

export interface KeyframeValues {
  lf: Foot;
  rf: Foot;
  /** 骨盆：[x, y, 高度, 朝向角°] */
  pel: readonly [number, number, number, number];
  /** 躯干：[朝向角°, 前倾°, 侧倾°（正值右肩下沉）] */
  tor: readonly [number, number, number];
  /** 头的朝向角° */
  hd: number;
  /** 右手（握在拍柄底部）的目标位置 */
  rh: Cyl;
  /** 球拍：[方位角°, 仰角°, 拍面滚转°] */
  rk: readonly [number, number, number];
  /** 右肘弯曲方向提示 */
  re: Vec3;
  /** 左手不握拍时的目标位置 */
  lh: Cyl;
  /** 左手握到拍杆上的权重 0..1 */
  lt: number;
  /** 左手握拍点离右手的距离（cm，沿拍杆）：28 是拍颈，9 是双手握拍 */
  lg: number;
  /** 左肘弯曲方向提示 */
  le: Vec3;
  a: Activation;
  /** 刹车标记 0..1 */
  br: number;
  /** 左脚承担的重心比例 0..1 */
  w: number;
}

export interface KeyframeSet {
  stroke: Stroke;
  stance: Stance;
  /** 5 个关键帧的时间（秒） */
  times: readonly number[];
  /** 击球帧的序号 */
  contactIndex: number;
  frames: readonly KeyframeValues[];
}

export interface Pose extends KeyframeValues {
  /** 两只脚此刻的抬起高度（cm）：[左, 右] */
  lift: readonly [number, number];
}
```

- [ ] **Step 2：写** `src/model/body.ts`

```ts
/** 人体尺寸（cm），身高约 175 */
export const BODY = {
  thigh: 46,
  shin: 44,
  ankleHeight: 8,
  hipHalf: 10,
  torso: 50,
  shoulderHalf: 18,
  neck: 8,
  headRadius: 10,
  upperArm: 29,
  forearm: 26,
  footLength: 15,
  heelBehindAnkle: 4,
  toeHeight: 1.5,
  heelLiftMaxDeg: 40,
} as const;

/** 球拍尺寸（cm），总长 68.5 */
export const RACKET = {
  buttBehindGrip: 4.5,
  throat: 28,
  headCenter: 47,
  headHalfLength: 17,
  headHalfWidth: 12.5,
} as const;

export const BALL_RADIUS = 3.35;

/** 5 个关键帧的时间（秒），序号 3 是击球 */
export const TIMES: readonly number[] = [0, 0.55, 0.8, 0.92, 1.22];
export const CONTACT_INDEX = 3;
```

- [ ] **Step 3：写** `src/model/keyframes/forehand.ts`

```ts
import { CONTACT_INDEX, TIMES } from '../body';
import type { KeyframeSet, KeyframeValues, Stance } from '../types';

/** 准备姿势：正手和反手共用 */
export const READY: KeyframeValues = {
  lf: [-27, 0, -8, 0], rf: [27, 0, 8, 0],
  pel: [0, 0, 86, 0], tor: [0, 14, 0], hd: 0,
  rh: [12, 32, 98], rk: [-20, 42, 90], re: [0.5, -0.2, -1],
  lh: [-10, 34, 104], lt: 1, lg: 28, le: [-0.5, -0.2, -1],
  a: [0, 0, 0, 0, 0], br: 0, w: 0.5,
};

const neutral: KeyframeValues[] = [
  READY,
  {
    lf: [6, 48, 45, 0], rf: [24, -10, 80, 0], pel: [18, 8, 78, 75], tor: [100, 10, -6], hd: 20,
    rh: [150, 55, 135], rk: [175, 50, 0], re: [0.6, -0.3, -0.8], lh: [75, 55, 135], lt: 0, lg: 28, le: [-0.3, 0.3, -1],
    a: [1, 0, 1, 0, 0], br: 0, w: 0.25,
  },
  {
    lf: [6, 48, 45, 0], rf: [24, -10, 80, 0.3], pel: [12, 22, 80, 15], tor: [70, 10, 10], hd: 25,
    rh: [128, 40, 100], rk: [185, -40, 0], re: [0.3, -0.5, -1], lh: [20, 42, 128], lt: 0, lg: 28, le: [-0.6, 0, -1],
    a: [1, 1, 0.15, 0, 0], br: 0, w: 0.55,
  },
  {
    lf: [6, 48, 45, 0], rf: [24, -10, 80, 0.7], pel: [8, 32, 84, 10], tor: [5, 8, 6], hd: 35,
    rh: [30, 54, 104], rk: [85, 2, 180], re: [0.3, -0.3, -1], lh: [-80, 44, 112], lt: 0, lg: 28, le: [-0.6, 0.2, -1],
    a: [0, 0, 1, 1, 1], br: 0, w: 0.8,
  },
  {
    lf: [6, 48, 45, 0], rf: [20, 0, 40, 1], pel: [2, 36, 88, -25], tor: [-65, 6, -4], hd: 15,
    rh: [-55, 26, 150], rk: [-165, 38, 0], re: [0.1, 1, 0.1], lh: [-70, 30, 132], lt: 0.8, lg: 28, le: [-0.5, 0, -1],
    a: [0, 0, 0.2, 0, 0], br: 1, w: 0.9,
  },
];

const semi: KeyframeValues[] = [
  READY,
  {
    lf: [-26, 28, 15, 0], rf: [24, -18, 50, 0], pel: [10, -6, 76, 58], tor: [102, 12, -6], hd: 25,
    rh: [150, 55, 135], rk: [175, 50, 0], re: [0.6, -0.3, -0.8], lh: [75, 55, 135], lt: 0, lg: 28, le: [-0.3, 0.3, -1],
    a: [1, 0, 1, 0, 0], br: 0, w: 0.25,
  },
  {
    lf: [-26, 28, 15, 0], rf: [24, -18, 50, 0.2], pel: [5, 0, 82, 3], tor: [62, 10, 10], hd: 25,
    rh: [128, 40, 100], rk: [185, -40, 0], re: [0.3, -0.5, -1], lh: [5, 40, 128], lt: 0, lg: 28, le: [-0.6, 0, -1],
    a: [1, 1, 0.15, 0, 0], br: 0, w: 0.45,
  },
  {
    lf: [-26, 28, 15, 0], rf: [24, -18, 50, 0.6], pel: [0, 6, 86, -2], tor: [-4, 8, 6], hd: 35,
    rh: [32, 54, 104], rk: [85, 2, 180], re: [0.3, -0.3, -1], lh: [-80, 44, 112], lt: 0, lg: 28, le: [-0.6, 0.2, -1],
    a: [0, 0, 1, 1, 1], br: 0, w: 0.6,
  },
  {
    lf: [-26, 28, 15, 0], rf: [22, -8, 25, 1], pel: [-5, 9, 89, -32], tor: [-72, 6, -4], hd: 15,
    rh: [-55, 26, 150], rk: [-165, 38, 0], re: [0.1, 1, 0.1], lh: [-70, 30, 132], lt: 0.8, lg: 28, le: [-0.5, 0, -1],
    a: [0, 0, 0.2, 0, 0], br: 1, w: 0.75,
  },
];

const open: KeyframeValues[] = [
  READY,
  {
    lf: [-36, 10, -5, 0], rf: [30, -6, 35, 0], pel: [12, -2, 75, 48], tor: [100, 12, -6], hd: 25,
    rh: [150, 55, 135], rk: [175, 50, 0], re: [0.6, -0.3, -0.8], lh: [75, 55, 135], lt: 0, lg: 28, le: [-0.3, 0.3, -1],
    a: [1, 0, 1, 0, 0], br: 0, w: 0.25,
  },
  {
    lf: [-36, 10, -5, 0], rf: [30, -6, 35, 0.3], pel: [8, 0, 82, -3], tor: [60, 10, 10], hd: 25,
    rh: [128, 40, 100], rk: [185, -40, 0], re: [0.3, -0.5, -1], lh: [5, 40, 128], lt: 0, lg: 28, le: [-0.6, 0, -1],
    a: [1, 1, 0.15, 0, 0], br: 0, w: 0.35,
  },
  {
    lf: [-36, 10, -5, 0], rf: [30, -6, 35, 0.6], pel: [3, 3, 86, -8], tor: [-6, 8, 6], hd: 35,
    rh: [38, 52, 104], rk: [88, 2, 180], re: [0.3, -0.3, -1], lh: [-80, 44, 112], lt: 0, lg: 28, le: [-0.6, 0.2, -1],
    a: [0, 0, 1, 1, 1], br: 0, w: 0.5,
  },
  {
    lf: [-36, 10, -5, 0], rf: [26, -2, 20, 1], pel: [-4, 5, 89, -38], tor: [-75, 6, -4], hd: 15,
    rh: [-55, 26, 150], rk: [-165, 38, 0], re: [0.1, 1, 0.1], lh: [-70, 30, 132], lt: 0.8, lg: 28, le: [-0.5, 0, -1],
    a: [0, 0, 0.2, 0, 0], br: 1, w: 0.65,
  },
];

const set = (stance: Stance, frames: KeyframeValues[]): KeyframeSet => ({
  stroke: 'forehand',
  stance,
  times: TIMES,
  contactIndex: CONTACT_INDEX,
  frames,
});

export const FOREHAND: Record<Stance, KeyframeSet> = {
  neutral: set('neutral', neutral),
  semi: set('semi', semi),
  open: set('open', open),
};
```

- [ ] **Step 4：类型检查**

Run: `npx tsc --noEmit`
Expected：无错误。

- [ ] **Step 5：提交**

```bash
git add -A && git commit -m "模型：类型、尺寸常量、正手三种站位关键帧"
```

---

### Task 4：关键帧插值

**Files:**
- Create: `src/model/interp.ts`
- Test: `tests/interp.test.ts`

- [ ] **Step 1：写失败的测试** `tests/interp.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { hermite, poseAt, segmentAt, tangent } from '../src/model/interp';
import { STANCES } from '../src/model/types';

describe('hermite / tangent', () => {
  it('首尾切线为 0', () => {
    expect(tangent([0, 1, 2], [0, 1, 2], 0, -1)).toBe(0);
    expect(tangent([0, 1, 2], [0, 1, 2], 2, -1)).toBe(0);
  });
  it('均匀直线的中间切线等于斜率', () => {
    expect(tangent([0, 1, 2], [0, 1, 2], 1, -1)).toBeCloseTo(1);
  });
  it('击球帧：来球一侧更陡时取该侧割线', () => {
    // 0→10 用 0.1 秒（斜率 100），10→12 用 0.3 秒（斜率约 6.7）
    expect(tangent([0, 10, 12], [0, 0.1, 0.4], 1, 1)).toBeCloseTo(100);
    expect(tangent([0, 10, 12], [0, 0.1, 0.4], 1, -1)).toBeLessThan(100);
  });
  it('hermite 经过关键帧', () => {
    const v = [0, 5, 3, 8];
    const T = [0, 1, 1.5, 3];
    expect(hermite(v, T, 1, 0, -1)).toBeCloseTo(5);
    expect(hermite(v, T, 1, 1, -1)).toBeCloseTo(3);
  });
  it('segmentAt 定位并夹紧到范围内', () => {
    expect(segmentAt([0, 1, 2], -1)).toEqual({ i: 0, s: 0 });
    expect(segmentAt([0, 1, 2], 1.5)).toEqual({ i: 1, s: 0.5 });
    expect(segmentAt([0, 1, 2], 9)).toEqual({ i: 1, s: 1 });
  });
});

describe('poseAt（正手）', () => {
  for (const stance of STANCES) {
    const set = FOREHAND[stance];
    it(`${stance}：关键帧时刻与关键帧一致，脚不抬起`, () => {
      set.frames.forEach((k, i) => {
        const p = poseAt(set, set.times[i]);
        k.pel.forEach((v, j) => expect(p.pel[j]).toBeCloseTo(v, 6));
        k.tor.forEach((v, j) => expect(p.tor[j]).toBeCloseTo(v, 6));
        k.rh.forEach((v, j) => expect(p.rh[j]).toBeCloseTo(v, 6));
        k.rk.forEach((v, j) => expect(p.rk[j]).toBeCloseTo(v, 6));
        k.lf.forEach((v, j) => expect(p.lf[j]).toBeCloseTo(v, 6));
        k.rf.forEach((v, j) => expect(p.rf[j]).toBeCloseTo(v, 6));
        expect(p.w).toBeCloseTo(k.w, 6);
        expect(p.lift[0]).toBeCloseTo(0, 6);
        expect(p.lift[1]).toBeCloseTo(0, 6);
      });
    });
    it(`${stance}：中间关键帧两侧速度连续`, () => {
      const h = 1e-5;
      for (let k = 1; k < set.times.length - 1; k++) {
        const t = set.times[k];
        for (const pick of [(p: ReturnType<typeof poseAt>) => p.tor[0], (p: ReturnType<typeof poseAt>) => p.rh[0]]) {
          const left = (pick(poseAt(set, t)) - pick(poseAt(set, t - h))) / h;
          const right = (pick(poseAt(set, t + h)) - pick(poseAt(set, t))) / h;
          expect(Math.abs(left - right)).toBeLessThan(1 + 0.01 * Math.abs(left));
        }
      }
    });
  }
  it('移动中的脚在两帧中间抬起', () => {
    const set = FOREHAND.neutral; // 左脚在第 0→1 帧向前迈步
    const p = poseAt(set, set.times[1] / 2);
    expect(p.lift[0]).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2：运行，确认失败**

Run: `npx vitest run tests/interp.test.ts`
Expected：FAIL，提示找不到 `../src/model/interp`。

- [ ] **Step 3：实现** `src/model/interp.ts`

```ts
import type { Activation, Cyl, Foot, KeyframeSet, KeyframeValues, Pose } from './types';
import type { Vec3 } from './vec';

type Pick = (k: KeyframeValues) => number;
type PickArr = (k: KeyframeValues) => readonly number[];

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const smoothstep = (s: number): number => s * s * (3 - 2 * s);

/**
 * 关键帧 k 处的切线（每秒变化量）：首尾为 0，中间取三点抛物线导数。
 * k 等于 contactIndex 时，如果来球一侧的割线更陡，就改用这条割线。
 */
export function tangent(v: readonly number[], T: readonly number[], k: number, contactIndex: number): number {
  if (k <= 0 || k >= v.length - 1) return 0;
  const d0 = T[k] - T[k - 1];
  const d1 = T[k + 1] - T[k];
  const s0 = (v[k] - v[k - 1]) / d0;
  const s1 = (v[k + 1] - v[k]) / d1;
  const m = (s0 * d1 + s1 * d0) / (d0 + d1);
  if (k === contactIndex && s0 * s1 > 0 && Math.abs(s0) > Math.abs(m)) return s0;
  return m;
}

export function hermite(v: readonly number[], T: readonly number[], i: number, s: number, contactIndex: number): number {
  const d = T[i + 1] - T[i];
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * v[i] +
    (s3 - 2 * s2 + s) * d * tangent(v, T, i, contactIndex) +
    (-2 * s3 + 3 * s2) * v[i + 1] +
    (s3 - s2) * d * tangent(v, T, i + 1, contactIndex)
  );
}

export function segmentAt(T: readonly number[], t: number): { i: number; s: number } {
  const last = T.length - 1;
  const u = clamp(t, T[0], T[last]);
  let i = 0;
  while (i < last - 1 && u > T[i + 1]) i++;
  return { i, s: (u - T[i]) / (T[i + 1] - T[i]) };
}

const asTuple = <R>(xs: number[]): R => xs as unknown as R;

/** 任意时刻 t（秒）的姿态 */
export function poseAt(set: KeyframeSet, t: number): Pose {
  const { times: T, frames: K, contactIndex } = set;
  const { i, s } = segmentAt(T, t);
  const sm = smoothstep(s);
  // 身体：普通三次插值；手和球拍：击球帧保持速度；离散类：smoothstep
  const body = (pick: Pick) => hermite(K.map(pick), T, i, s, -1);
  const hand = (pick: Pick) => hermite(K.map(pick), T, i, s, contactIndex);
  const step = (pick: Pick) => pick(K[i]) + (pick(K[i + 1]) - pick(K[i])) * sm;
  const each = (pick: PickArr, f: (p: Pick) => number) => pick(K[i]).map((_, j) => f((k) => pick(k)[j]));
  const lift = (pick: (k: KeyframeValues) => Foot) => {
    const a = pick(K[i]);
    const b = pick(K[i + 1]);
    return Math.sin(Math.PI * s) * Math.min(10, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.3);
  };
  return {
    lf: asTuple<Foot>(each((k) => k.lf, step)),
    rf: asTuple<Foot>(each((k) => k.rf, step)),
    pel: asTuple<KeyframeValues['pel']>(each((k) => k.pel, body)),
    tor: asTuple<KeyframeValues['tor']>(each((k) => k.tor, body)),
    hd: body((k) => k.hd),
    rh: asTuple<Cyl>(each((k) => k.rh, hand)),
    rk: asTuple<KeyframeValues['rk']>(each((k) => k.rk, hand)),
    re: asTuple<Vec3>(each((k) => k.re, body)),
    lh: asTuple<Cyl>(each((k) => k.lh, body)),
    lt: step((k) => k.lt),
    lg: step((k) => k.lg),
    le: asTuple<Vec3>(each((k) => k.le, body)),
    a: asTuple<Activation>(each((k) => k.a, step)),
    br: step((k) => k.br),
    w: step((k) => k.w),
    lift: [lift((k) => k.lf), lift((k) => k.rf)],
  };
}
```

- [ ] **Step 4：运行，确认通过**

Run: `npx vitest run tests/interp.test.ts`
Expected：PASS。

- [ ] **Step 5：提交**

```bash
git add -A && git commit -m "模型：关键帧插值（身体三次插值、手和球拍击球保速、离散量平滑过渡、迈步抬脚）"
```

---

### Task 5：骨架求解

**Files:**
- Create: `src/model/solve.ts`
- Test: `tests/solve.test.ts`

- [ ] **Step 1：写失败的测试** `tests/solve.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BODY, RACKET } from '../src/model/body';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { poseAt } from '../src/model/interp';
import { footJoints, racketGeom, solvePose, solveTwoBone } from '../src/model/solve';
import { dist, dot, length } from '../src/model/vec';

describe('solveTwoBone', () => {
  it('够得着时保持两段长度，关节朝提示方向弯', () => {
    const r = solveTwoBone([0, 0, 0], [30, 0, 0], 20, 20, [0, 0, 1]);
    expect(dist([0, 0, 0], r.joint)).toBeCloseTo(20);
    expect(dist(r.joint, r.end)).toBeCloseTo(20);
    expect(r.joint[2]).toBeGreaterThan(0);
    expect(r.reach).toBeCloseTo(0.75);
  });
  it('够不着时拉直而不拉长，并报告 reach > 1', () => {
    const r = solveTwoBone([0, 0, 0], [100, 0, 0], 20, 20, [0, 0, 1]);
    expect(dist([0, 0, 0], r.joint)).toBeCloseTo(20);
    expect(dist(r.joint, r.end)).toBeCloseTo(20);
    expect(r.reach).toBeGreaterThan(1);
  });
});

describe('footJoints', () => {
  it('抬脚跟时脚尖不动、脚长不变、踝关节升高', () => {
    const flat = footJoints([10, 20, 30, 0], 0);
    const up = footJoints([10, 20, 30, 1], 0);
    expect(dist(flat.toe, up.toe)).toBeCloseTo(0);
    expect(dist(flat.ankle, flat.toe)).toBeCloseTo(dist(up.ankle, up.toe));
    expect(flat.ankle[2]).toBeCloseTo(BODY.ankleHeight);
    expect(up.ankle[2]).toBeGreaterThan(flat.ankle[2]);
  });
});

describe('racketGeom', () => {
  it('拍杆方向、拍面法线、拍面宽度两两垂直，且都是单位向量', () => {
    const g = racketGeom([0, 0, 100], [30, 10, 45], 9);
    expect(length(g.dir)).toBeCloseTo(1);
    expect(length(g.normal)).toBeCloseTo(1);
    expect(length(g.width)).toBeCloseTo(1);
    expect(dot(g.dir, g.normal)).toBeCloseTo(0);
    expect(dot(g.dir, g.width)).toBeCloseTo(0);
    expect(dot(g.normal, g.width)).toBeCloseTo(0);
    expect(dist(g.grip, g.center)).toBeCloseTo(RACKET.headCenter);
    expect(dist(g.grip, g.leftGrip)).toBeCloseTo(9);
  });
});

describe('solvePose', () => {
  it('骨段长度恒定', () => {
    const set = FOREHAND.semi;
    for (const t of [0, 0.3, 0.55, 0.8, 0.92, 1.1, 1.22]) {
      const j = solvePose(poseAt(set, t));
      expect(dist(j.hipL, j.kneeL)).toBeCloseTo(BODY.thigh, 3);
      expect(dist(j.kneeR, j.footR.ankle)).toBeCloseTo(BODY.shin, 3);
      expect(dist(j.shoulderR, j.elbowR)).toBeCloseTo(BODY.upperArm, 3);
      expect(dist(j.elbowL, j.wristL)).toBeCloseTo(BODY.forearm, 3);
    }
  });
  it('正手准备姿势：左手扶在拍颈上', () => {
    expect(solvePose(poseAt(FOREHAND.semi, 0)).gripError).toBeLessThan(1);
  });
});
```

- [ ] **Step 2：运行，确认失败**

Run: `npx vitest run tests/solve.test.ts`
Expected：FAIL，提示找不到 `../src/model/solve`。

- [ ] **Step 3：实现** `src/model/solve.ts`

```ts
import { BODY, RACKET } from './body';
import type { Cyl, Foot, Pose } from './types';
import { DEG, type Vec3, add, azimuth, cross, dist, dot, length, lerp3, normalize, scale, sub } from './vec';

export interface IkResult {
  joint: Vec3;
  end: Vec3;
  /** 目标距离 ÷ 两段总长；接近或大于 1 表示够不着，末端被拉回 */
  reach: number;
}

/** 两段式 IK：根 A 伸向目标 C，段长 a、b，hint 指定关节往哪边弯 */
export function solveTwoBone(A: Vec3, C: Vec3, a: number, b: number, hint: Vec3): IkResult {
  let d = sub(C, A);
  let L = Math.max(1e-6, length(d));
  const reach = L / (a + b);
  const max = a + b - 0.5;
  let end = C;
  if (L > max) {
    end = add(A, scale(d, max / L));
    d = sub(end, A);
    L = max;
  }
  const n = scale(d, 1 / L);
  const x = (a * a - b * b + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  let bend = sub(hint, scale(n, dot(hint, n)));
  if (length(bend) < 1e-6) bend = Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0]);
  return { joint: add(add(A, scale(n, x)), scale(normalize(bend), h)), end, reach };
}

export interface FootJoints {
  ankle: Vec3;
  toe: Vec3;
  heel: Vec3;
  dir: Vec3;
}

/** 脚的关节：抬脚跟时整只脚绕脚尖转动 */
export function footJoints(f: Foot, lift: number): FootJoints {
  const dir = azimuth(f[2]);
  const toe: Vec3 = [f[0] + dir[0] * BODY.footLength, f[1] + dir[1] * BODY.footLength, BODY.toeHeight + lift];
  const alpha = f[3] * BODY.heelLiftMaxDeg * DEG;
  // (u 沿脚尖方向, v 向上) 相对脚尖的坐标，顺时针转 alpha
  const rot = (u: number, v: number): Vec3 => {
    const ru = u * Math.cos(alpha) + v * Math.sin(alpha);
    const rv = -u * Math.sin(alpha) + v * Math.cos(alpha);
    return [toe[0] + dir[0] * ru, toe[1] + dir[1] * ru, toe[2] + rv];
  };
  return {
    dir,
    toe,
    ankle: rot(-BODY.footLength, BODY.ankleHeight - BODY.toeHeight),
    heel: rot(-BODY.footLength - BODY.heelBehindAnkle, -BODY.toeHeight),
  };
}

export interface RacketGeom {
  dir: Vec3;
  normal: Vec3;
  width: Vec3;
  butt: Vec3;
  grip: Vec3;
  leftGrip: Vec3;
  throat: Vec3;
  center: Vec3;
  rim: Vec3[];
}

/** 球拍几何：grip 是右手位置，rk = [方位角°, 仰角°, 拍面滚转°] */
export function racketGeom(grip: Vec3, rk: readonly [number, number, number], leftGripOffset: number): RacketGeom {
  const az = rk[0] * DEG;
  const el = rk[1] * DEG;
  const roll = rk[2] * DEG;
  const dir: Vec3 = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
  let e1 = cross(dir, [0, 0, 1]);
  e1 = length(e1) < 0.05 ? [1, 0, 0] : normalize(e1);
  const e2 = cross(e1, dir);
  const normal = add(scale(e1, Math.cos(roll)), scale(e2, Math.sin(roll)));
  const width = cross(dir, normal);
  const center = add(grip, scale(dir, RACKET.headCenter));
  const rim: Vec3[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    rim.push(add(add(center, scale(dir, RACKET.headHalfLength * Math.cos(a))), scale(width, RACKET.headHalfWidth * Math.sin(a))));
  }
  return {
    dir,
    normal,
    width,
    center,
    rim,
    grip,
    butt: add(grip, scale(dir, -RACKET.buttBehindGrip)),
    leftGrip: add(grip, scale(dir, leftGripOffset)),
    throat: add(grip, scale(dir, RACKET.throat)),
  };
}

export interface Joints {
  pelvis: Vec3;
  pelvisRight: Vec3;
  hipL: Vec3;
  hipR: Vec3;
  kneeL: Vec3;
  kneeR: Vec3;
  footL: FootJoints;
  footR: FootJoints;
  chest: Vec3;
  torsoUp: Vec3;
  torsoRight: Vec3;
  torsoForward: Vec3;
  shoulderL: Vec3;
  shoulderR: Vec3;
  neck: Vec3;
  head: Vec3;
  nose: Vec3;
  elbowL: Vec3;
  wristL: Vec3;
  elbowR: Vec3;
  wristR: Vec3;
  racket: RacketGeom;
  reach: { legL: number; legR: number; armL: number; armR: number };
  /** 左手离应握位置的距离（cm），左手握拍时才有意义 */
  gripError: number;
}

export function solvePose(p: Pose): Joints {
  const pelvis: Vec3 = [p.pel[0], p.pel[1], p.pel[2]];
  const py = p.pel[3] * DEG;
  const pelvisRight: Vec3 = [Math.cos(py), -Math.sin(py), 0];
  const hipL = add(pelvis, scale(pelvisRight, -BODY.hipHalf));
  const hipR = add(pelvis, scale(pelvisRight, BODY.hipHalf));

  const ty = p.tor[0] * DEG;
  const pitch = p.tor[1] * DEG;
  const roll = p.tor[2] * DEG;
  const fwd0: Vec3 = [Math.sin(ty), Math.cos(ty), 0];
  const right0: Vec3 = [Math.cos(ty), -Math.sin(ty), 0];
  const up1 = add(scale([0, 0, 1], Math.cos(pitch)), scale(fwd0, Math.sin(pitch)));
  const torsoUp = add(scale(up1, Math.cos(roll)), scale(right0, Math.sin(roll)));
  const torsoRight = sub(scale(right0, Math.cos(roll)), scale(up1, Math.sin(roll)));
  const torsoForward = cross(torsoUp, torsoRight);

  const chest = add(pelvis, scale(torsoUp, BODY.torso));
  const shoulderL = add(chest, scale(torsoRight, -BODY.shoulderHalf));
  const shoulderR = add(chest, scale(torsoRight, BODY.shoulderHalf));
  const neck = add(chest, scale(torsoUp, BODY.neck));
  const head = add(chest, scale(torsoUp, BODY.neck + BODY.headRadius));
  const nose = add(head, scale(azimuth(p.hd), BODY.headRadius * 0.95));

  const footL = footJoints(p.lf, p.lift[0]);
  const footR = footJoints(p.rf, p.lift[1]);
  const kneeHint = (f: FootJoints): Vec3 => add(f.dir, [0, 0, 0.15]);
  const legL = solveTwoBone(hipL, footL.ankle, BODY.thigh, BODY.shin, kneeHint(footL));
  const legR = solveTwoBone(hipR, footR.ankle, BODY.thigh, BODY.shin, kneeHint(footR));

  const cyl = (c: Cyl): Vec3 => [pelvis[0] + c[1] * Math.sin(c[0] * DEG), pelvis[1] + c[1] * Math.cos(c[0] * DEG), c[2]];
  const armR = solveTwoBone(shoulderR, cyl(p.rh), BODY.upperArm, BODY.forearm, p.re);
  const racket = racketGeom(armR.end, p.rk, p.lg);
  const armL = solveTwoBone(shoulderL, lerp3(cyl(p.lh), racket.leftGrip, p.lt), BODY.upperArm, BODY.forearm, p.le);

  return {
    pelvis,
    pelvisRight,
    hipL,
    hipR,
    kneeL: legL.joint,
    kneeR: legR.joint,
    footL,
    footR,
    chest,
    torsoUp,
    torsoRight,
    torsoForward,
    shoulderL,
    shoulderR,
    neck,
    head,
    nose,
    elbowL: armL.joint,
    wristL: armL.end,
    elbowR: armR.joint,
    wristR: armR.end,
    racket,
    reach: { legL: legL.reach, legR: legR.reach, armL: armL.reach, armR: armR.reach },
    gripError: dist(armL.end, racket.leftGrip),
  };
}
```

- [ ] **Step 4：运行，确认通过**

Run: `npx vitest run tests/solve.test.ts`
Expected：PASS。

- [ ] **Step 5：提交**

```bash
git add -A && git commit -m "模型：骨架求解（两段式 IK、绕脚尖踮脚、球拍几何、双手握拍点）"
```

---

### Task 6：派生指标

**Files:**
- Create: `src/model/metrics.ts`
- Test: `tests/metrics.test.ts`

- [ ] **Step 1：写失败的测试** `tests/metrics.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { poseAt } from '../src/model/interp';
import { chainCurves, peakTime, racketSpeed, shoulderHipSeparation } from '../src/model/metrics';

describe('metrics', () => {
  it('肩髋差 = 躯干朝向 − 骨盆朝向', () => {
    expect(shoulderHipSeparation(poseAt(FOREHAND.semi, 0))).toBeCloseTo(0);
    expect(shoulderHipSeparation(poseAt(FOREHAND.semi, 0.55))).toBeCloseTo(44);
  });
  it('击球时拍头速度在 10–30 m/s（业余水平的示意值）', () => {
    const v = racketSpeed(FOREHAND.semi, 0.92);
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(30);
  });
  it('发力链曲线各数组等长', () => {
    const c = chainCurves(FOREHAND.semi, 50);
    for (const k of ['t', 'pelvis', 'torso', 'arm', 'head'] as const) expect(c[k]).toHaveLength(51);
  });
  it('peakTime 取最大值所在时刻', () => {
    expect(peakTime([0, 1, 2], [3, 9, 4])).toBe(1);
  });
});
```

- [ ] **Step 2：运行，确认失败**

Run: `npx vitest run tests/metrics.test.ts`
Expected：FAIL，提示找不到 `../src/model/metrics`。

- [ ] **Step 3：实现** `src/model/metrics.ts`

```ts
import { poseAt } from './interp';
import { solvePose } from './solve';
import type { KeyframeSet, Pose } from './types';
import { DEG, dist, lerp3 } from './vec';

/** 肩髋差（度）：躯干朝向减骨盆朝向 */
export const shoulderHipSeparation = (p: Pose): number => p.tor[0] - p.pel[3];

/** 拍头（拍面中心）速度，m/s */
export function racketSpeed(set: KeyframeSet, t: number, h = 0.002): number {
  const a = solvePose(poseAt(set, t - h)).racket.center;
  const b = solvePose(poseAt(set, t + h)).racket.center;
  return dist(a, b) / (2 * h) / 100;
}

export interface ChainCurves {
  t: number[];
  /** 骨盆转速，度/秒，正值表示朝击球方向转 */
  pelvis: number[];
  /** 躯干转速，度/秒 */
  torso: number[];
  /** 手腕绕骨盆竖轴的角速度，度/秒 */
  arm: number[];
  /** 拍头线速度，m/s */
  head: number[];
}

const wrap180 = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/** 图 01 的发力链曲线：从引拍结束到随挥结束 */
export function chainCurves(set: KeyframeSet, n = 300): ChainCurves {
  const t0 = set.times[1];
  const t1 = set.times[set.times.length - 1];
  const sign = set.stroke === 'forehand' ? -1 : 1;
  const h = 0.002;
  const armAngle = (t: number): number => {
    const p = poseAt(set, t);
    const j = solvePose(p);
    const w = set.stroke === 'forehand' ? j.wristR : lerp3(j.wristR, j.wristL, 0.5);
    return Math.atan2(w[0] - p.pel[0], w[1] - p.pel[1]) / DEG;
  };
  const out: ChainCurves = { t: [], pelvis: [], torso: [], arm: [], head: [] };
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const a = poseAt(set, t - h);
    const b = poseAt(set, t + h);
    out.t.push(t);
    out.pelvis.push((sign * (b.pel[3] - a.pel[3])) / (2 * h));
    out.torso.push((sign * (b.tor[0] - a.tor[0])) / (2 * h));
    out.arm.push((sign * wrap180(armAngle(t + h) - armAngle(t - h))) / (2 * h));
    out.head.push(dist(solvePose(a).racket.center, solvePose(b).racket.center) / (2 * h) / 100);
  }
  return out;
}

/** 曲线最大值所在的时刻 */
export function peakTime(t: readonly number[], v: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
  return t[best];
}
```

- [ ] **Step 4：运行，确认通过**

Run: `npx vitest run tests/metrics.test.ts`
Expected：PASS。

- [ ] **Step 5：提交**

```bash
git add -A && git commit -m "模型：派生指标（肩髋差、拍头速度、发力链曲线）"
```

---

### Task 7：正手的模型约束测试

**Files:**
- Test: `tests/constraints.test.ts`

规格 5.5 节的 6 条约束。本任务先对正手生效；Task 8 加入反手后改为覆盖全部 6 套动作。

- [ ] **Step 1：写测试** `tests/constraints.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BODY } from '../src/model/body';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { poseAt } from '../src/model/interp';
import { chainCurves, peakTime, racketSpeed } from '../src/model/metrics';
import { solvePose } from '../src/model/solve';
import type { KeyframeSet } from '../src/model/types';
import { angleBetween, dist, lerp3, sub, type Vec3 } from '../src/model/vec';

const END = (s: KeyframeSet) => s.times[s.times.length - 1];
const CONTACT = (s: KeyframeSet) => s.times[s.contactIndex];
const LEG_CLAMP = (BODY.thigh + BODY.shin - 0.5) / (BODY.thigh + BODY.shin);

function racketPath(set: KeyframeSet, n = 6000): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) out.push(solvePose(poseAt(set, (END(set) * i) / n)).racket.center);
  return out;
}

/** 按弧长每 step cm 重新取点 */
function resample(points: Vec3[], step: number): Vec3[] {
  const out: Vec3[] = [points[0]];
  let a = points[0];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    let seg = dist(a, b);
    while (carry + seg >= step) {
      a = lerp3(a, b, (step - carry) / seg);
      out.push(a);
      seg = dist(a, b);
      carry = 0;
    }
    carry += seg;
    a = b;
  }
  return out;
}

function maxTurnDeg(points: Vec3[]): number {
  let max = 0;
  for (let i = 2; i < points.length; i++) {
    max = Math.max(max, angleBetween(sub(points[i - 1], points[i - 2]), sub(points[i], points[i - 1])));
  }
  return max;
}

export function checkConstraints(label: string, set: KeyframeSet) {
  describe(label, () => {
    it('1. 拍头轨迹没有折角：每 1 cm 一段，相邻段转角 < 4°', () => {
      expect(maxTurnDeg(resample(racketPath(set), 1))).toBeLessThan(4);
    });

    it('2. 拍头速度峰值在击球前后 0.03 秒内', () => {
      let best = 0;
      let bestT = 0;
      for (let t = 0.6; t <= END(set); t += 0.002) {
        const v = racketSpeed(set, t);
        if (v > best) {
          best = v;
          bestT = t;
        }
      }
      expect(Math.abs(bestT - CONTACT(set))).toBeLessThanOrEqual(0.03);
    });

    it('3. 发力顺序：骨盆 → 躯干 → 手臂 → 拍头，拍头峰值在击球前后 0.05 秒内', () => {
      const c = chainCurves(set, 400);
      const tp = peakTime(c.t, c.pelvis);
      const tt = peakTime(c.t, c.torso);
      const ta = peakTime(c.t, c.arm);
      const th = peakTime(c.t, c.head);
      expect(tp).toBeLessThan(tt);
      expect(tt).toBeLessThan(ta);
      expect(ta).toBeLessThan(th);
      expect(Math.abs(th - CONTACT(set))).toBeLessThanOrEqual(0.05);
    });

    it('4. 踩稳的脚不打滑：脚尖漂移 < 0.5 cm', () => {
      for (let k = 0; k < set.frames.length - 1; k++) {
        for (const side of ['lf', 'rf'] as const) {
          const a = set.frames[k][side];
          const b = set.frames[k + 1][side];
          if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) continue;
          const foot = side === 'lf' ? 'footL' : 'footR';
          const toe0 = solvePose(poseAt(set, set.times[k]))[foot].toe;
          for (let s = 1; s <= 20; s++) {
            const t = set.times[k] + ((set.times[k + 1] - set.times[k]) * s) / 20;
            expect(dist(solvePose(poseAt(set, t))[foot].toe, toe0)).toBeLessThan(0.5);
          }
        }
      }
    });

    it('5. 骨段长度恒定，腿始终够得着地面', () => {
      for (let i = 0; i <= 200; i++) {
        const j = solvePose(poseAt(set, (END(set) * i) / 200));
        expect(j.reach.legL).toBeLessThan(LEG_CLAMP);
        expect(j.reach.legR).toBeLessThan(LEG_CLAMP);
        expect(Math.abs(dist(j.hipL, j.kneeL) - BODY.thigh)).toBeLessThan(0.5);
        expect(Math.abs(dist(j.kneeR, j.footR.ankle) - BODY.shin)).toBeLessThan(0.5);
        expect(Math.abs(dist(j.shoulderL, j.elbowL) - BODY.upperArm)).toBeLessThan(0.5);
        expect(Math.abs(dist(j.elbowR, j.wristR) - BODY.forearm)).toBeLessThan(0.5);
      }
    });

    it('6. 左手握拍时不脱手：误差 < 1 cm', () => {
      for (let i = 0; i <= 200; i++) {
        const p = poseAt(set, (END(set) * i) / 200);
        if (p.lt < 0.99) continue;
        expect(solvePose(p).gripError).toBeLessThan(1);
      }
    });
  });
}

for (const [stance, set] of Object.entries(FOREHAND)) checkConstraints(`forehand/${stance}`, set);
```

- [ ] **Step 2：运行**

Run: `npx vitest run tests/constraints.test.ts`
Expected：18 个用例全部 PASS。预先在原型引擎上做的实验数据：三种站位的峰值依次约为骨盆 0.67 s、躯干 0.86 s、手臂 0.88 s、拍头 0.90 s；1 cm 分段的最大转角 3.3–3.7°。

- [ ] **Step 3：如果有失败，按下面的规则调整** `src/model/keyframes/forehand.ts`，每次只改一个数，重新运行：
  - 第 1 条（折角）：找到最大转角所在时刻，平滑该时段手（`rh`）或球拍（`rk`）的关键帧数值，让相邻两帧的变化更均匀。
  - 第 2 条（速度峰值早于击球太多）：把击球帧的 `rh[0]` 往来球一侧挪 2°～4°，让最后一段挥得更快。
  - 第 3 条（顺序不对）：骨盆峰值太晚就让第 3 帧 `pel[3]` 更接近第 4 帧；躯干和手臂同时到峰，就把第 3 帧 `tor[0]` 增大 5°～10°（让更多躯干转动发生在最后一段）。
  - 第 4、5 条（打滑、腿够不着）：降低对应帧骨盆高度 `pel[2]` 2～3 cm，或把那只脚往身体方向挪 3～5 cm。
  - 第 6 条（脱手）：把准备姿势的 `lh` 往拍颈方向挪，或调整 `le`。

- [ ] **Step 4：提交**

```bash
git add -A && git commit -m "测试：正手动作的 6 条模型约束"
```

---

### Task 8：镜像和双手反手

**Files:**
- Create: `src/model/mirror.ts`、`src/model/keyframes/backhand.ts`、`src/model/index.ts`
- Test: `tests/mirror.test.ts`
- Modify: `tests/interp.test.ts`、`tests/constraints.test.ts`（改为覆盖全部 6 套动作）

- [ ] **Step 1：写失败的测试** `tests/mirror.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { FOREHAND } from '../src/model/keyframes/forehand';
import { mirrorKeyframe } from '../src/model/mirror';
import type { KeyframeValues } from '../src/model/types';

const flat = (k: KeyframeValues): number[] =>
  [k.lf, k.rf, k.pel, k.tor, [k.hd], k.rh, k.rk, k.re, k.lh, [k.lt, k.lg], k.le, k.a, [k.br, k.w]].flatMap((x) => [...x]);

describe('mirrorKeyframe', () => {
  it('镜像两次回到原样', () => {
    for (const k of FOREHAND.semi.frames) {
      const a = flat(k);
      const b = flat(mirrorKeyframe(mirrorKeyframe(k)));
      a.forEach((x, i) => expect(b[i]).toBeCloseTo(x, 9));
    }
  });
  it('左右脚互换、x 和朝向取反、重心比例取补', () => {
    const k = FOREHAND.open.frames[1];
    const m = mirrorKeyframe(k);
    expect(m.lf).toEqual([-k.rf[0], k.rf[1], -k.rf[2], k.rf[3]]);
    expect(m.pel[3]).toBe(-k.pel[3]);
    expect(m.w).toBeCloseTo(1 - k.w);
  });
});
```

- [ ] **Step 2：运行，确认失败**

Run: `npx vitest run tests/mirror.test.ts`
Expected：FAIL，提示找不到 `../src/model/mirror`。

- [ ] **Step 3：实现** `src/model/mirror.ts`

```ts
import type { Cyl, Foot, KeyframeValues } from './types';
import type { Vec3 } from './vec';

const mFoot = (f: Foot): Foot => [-f[0], f[1], -f[2], f[3]];
const mVec = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];
const mCyl = (c: Cyl): Cyl => [-c[0], c[1], c[2]];

/**
 * 左右镜像一个关键帧：x 取反、偏航角取反、左右肢体互换、重心比例取补。
 * 拍面滚转角 r 镜像后是 180 − r（镜像会翻转叉积方向）。
 */
export function mirrorKeyframe(k: KeyframeValues): KeyframeValues {
  return {
    lf: mFoot(k.rf),
    rf: mFoot(k.lf),
    pel: [-k.pel[0], k.pel[1], k.pel[2], -k.pel[3]],
    tor: [-k.tor[0], k.tor[1], -k.tor[2]],
    hd: -k.hd,
    rh: mCyl(k.rh),
    rk: [-k.rk[0], k.rk[1], 180 - k.rk[2]],
    re: mVec(k.le),
    lh: mCyl(k.lh),
    lt: k.lt,
    lg: k.lg,
    le: mVec(k.re),
    a: k.a,
    br: k.br,
    w: 1 - k.w,
  };
}
```

- [ ] **Step 4：运行镜像测试，确认通过**

Run: `npx vitest run tests/mirror.test.ts`
Expected：PASS。

- [ ] **Step 5：写反手关键帧** `src/model/keyframes/backhand.ts`

初始值的依据：双手反手的手位要让右臂（从右肩伸过来）和左臂都够得着同一根拍柄，所以手比镜像正手更靠近身体中线；击球点离身体比正手近；引拍肩转约 110°。

```ts
import { CONTACT_INDEX, TIMES } from '../body';
import { mirrorKeyframe } from '../mirror';
import type { KeyframeSet, KeyframeValues, Stance } from '../types';
import { FOREHAND, READY } from './forehand';

type Adjust = (m: KeyframeValues) => Partial<KeyframeValues>;

/**
 * 双手反手：身体取正手的左右镜像，手和球拍按双手握拍重新设定。
 * 右手握拍柄底部，左手在上方 9 cm；准备姿势与正手相同（左手扶拍颈，引拍时滑下来）。
 */
const ADJUST: readonly Adjust[] = [
  () => ({}),
  (m) => ({
    tor: [-110, m.tor[1], m.tor[2]],
    rh: [-125, 38, 120], rk: [-170, 40, 180], re: [0.2, 0.6, -0.8], le: [-0.6, -0.3, -0.8], lt: 1, lg: 9,
  }),
  () => ({ rh: [-115, 36, 98], rk: [-185, -40, 180], re: [0.3, 0.4, -1], le: [-0.3, -0.5, -1], lt: 1, lg: 9 }),
  () => ({ rh: [-10, 40, 104], rk: [-82, 2, 0], re: [0.2, 0.2, -1], le: [-0.3, -0.3, -1], lt: 1, lg: 9 }),
  () => ({ rh: [55, 26, 150], rk: [165, 38, 180], re: [0.3, 0.8, 0.3], le: [-0.1, 1, 0.1], lt: 1, lg: 9 }),
];

function backhandFrames(stance: Stance): KeyframeValues[] {
  return FOREHAND[stance].frames.map((f, i) => {
    if (i === 0) return READY;
    const m = mirrorKeyframe(f);
    return { ...m, ...ADJUST[i](m) };
  });
}

const set = (stance: Stance): KeyframeSet => ({
  stroke: 'backhand',
  stance,
  times: TIMES,
  contactIndex: CONTACT_INDEX,
  frames: backhandFrames(stance),
});

export const BACKHAND: Record<Stance, KeyframeSet> = {
  neutral: set('neutral'),
  semi: set('semi'),
  open: set('open'),
};
```

- [ ] **Step 6：写对外接口** `src/model/index.ts`

```ts
import { BACKHAND } from './keyframes/backhand';
import { FOREHAND } from './keyframes/forehand';
import type { KeyframeSet, Stance, Stroke } from './types';

export const SETS: Record<Stroke, Record<Stance, KeyframeSet>> = { forehand: FOREHAND, backhand: BACKHAND };
export const getSet = (stroke: Stroke, stance: Stance): KeyframeSet => SETS[stroke][stance];

export * from './types';
export { BODY, RACKET, BALL_RADIUS, TIMES, CONTACT_INDEX } from './body';
export { poseAt } from './interp';
export { solvePose, type Joints, type RacketGeom, type FootJoints } from './solve';
export { shoulderHipSeparation, racketSpeed, chainCurves, peakTime, type ChainCurves } from './metrics';
```

- [ ] **Step 7：把插值测试和约束测试扩展到全部 6 套**

`tests/interp.test.ts`：把 `import { FOREHAND } from '../src/model/keyframes/forehand';` 换成 `import { SETS } from '../src/model';`，把 `import { STANCES } from '../src/model/types';` 换成 `import { STANCES, STROKES } from '../src/model/types';`，并把 `describe('poseAt（正手）', () => { for (const stance of STANCES) { const set = FOREHAND[stance];` 改成：

```ts
describe('poseAt', () => {
  for (const stroke of STROKES) for (const stance of STANCES) {
    const set = SETS[stroke][stance];
```

（用例标题里的 `${stance}` 改成 `${stroke}/${stance}`；"移动中的脚"那个用例里的 `FOREHAND.neutral` 改成 `SETS.forehand.neutral`。）

`tests/constraints.test.ts`：最后一行换成：

```ts
for (const [stroke, byStance] of Object.entries(SETS)) {
  for (const [stance, set] of Object.entries(byStance)) checkConstraints(`${stroke}/${stance}`, set);
}
```

并把 `import { FOREHAND } from '../src/model/keyframes/forehand';` 换成 `import { SETS } from '../src/model';`。

- [ ] **Step 8：运行全部测试**

Run: `npx vitest run`
Expected：正手全部 PASS；反手的约束测试可能有失败——初始值是估算的。

- [ ] **Step 9：按失败项调整反手** `src/model/keyframes/backhand.ts` 的 `ADJUST`（必要时为某个站位单独覆盖），规则：
  - 第 6 条（脱手）或第 5 条（手臂够不着）：把该帧 `rh` 的半径 `rh[1]` 减小 3～5 cm，或把方位角 `rh[0]` 往 0（身体前方）挪 10°～15°；必要时调整 `re`、`le` 让肘部往外。
  - 第 2 条（速度峰值时刻）：同正手规则，调击球帧 `rh[0]`。
  - 第 3 条（顺序）：反手的发力方向与正手相反（偏航角增大），调整原则同正手：骨盆第 3 帧更接近击球帧，躯干第 3 帧落后一些。如需改身体，在 `ADJUST` 里覆盖 `pel`、`tor`。
  - 第 1 条（折角）：平滑相邻帧之间 `rk[0]` 的变化，注意角度要按"顺着挥拍方向"连续变化（比如 −170 → −185 → −82 → 165），不能出现绕远路的跳变。
  每改一处就重新运行 `npx vitest run tests/constraints.test.ts`，直到全部通过。

- [ ] **Step 10：提交**

```bash
git add -A && git commit -m "模型：镜像工具和双手反手三种站位，约束测试覆盖全部 6 套动作"
```

---

### Task 9：2D 渲染器和检查台

**Files:**
- Create: `src/render2d/project.ts`、`src/render2d/stickFigure.ts`、`dev/viewer.html`、`src/dev/viewer.ts`

- [ ] **Step 1：写投影** `src/render2d/project.ts`

```ts
import { DEG, type Vec3 } from '../model/vec';

/** 2D 相机：phi 是相机所在的方位角（0 在球网一侧），elev 是俯视角 */
export interface Camera2D {
  phi: number;
  elev: number;
  scale: number;
  cx: number;
  groundY: number;
}

/** [屏幕 x, 屏幕 y, 朝向相机的深度（越大越近）] */
export type Projected = readonly [number, number, number];

export function projector(c: Camera2D): (v: Vec3) => Projected {
  const cp = Math.cos(c.phi * DEG);
  const sp = Math.sin(c.phi * DEG);
  const ce = Math.cos(c.elev * DEG);
  const se = Math.sin(c.elev * DEG);
  return (q) => {
    const sx = -q[0] * cp + q[1] * sp;
    const depth = q[0] * sp + q[1] * cp;
    const sy = q[2] * ce - depth * se;
    return [c.cx + c.scale * sx, c.groundY - c.scale * sy, depth];
  };
}
```

- [ ] **Step 2：写火柴人渲染** `src/render2d/stickFigure.ts`

颜色全部用 CSS 变量（`--fig-near`、`--fig-far`、`--fig-fill`、`--signal`、`--brake`、`--ink`、`--faint`、`--text-2`、`--ball`），由页面的主题样式提供。

```ts
import { BODY, type Joints, type Pose } from '../model';
import { type Vec3, add, scale } from '../model/vec';
import { type Camera2D, type Projected, projector } from './project';

export interface FigureOptions {
  path?: readonly Vec3[];
  trail?: readonly Vec3[];
  ball?: { p: Vec3; opacity: number } | null;
  inset?: { cx: number; cy: number; r: number; big?: boolean };
  labels?: { net: string; separation: string };
  /** 双手反手：两条手臂都显示发力和刹车 */
  bothArms?: boolean;
}

const C = {
  near: 'var(--fig-near)',
  far: 'var(--fig-far)',
  fill: 'var(--fig-fill)',
  signal: 'var(--signal)',
  brake: 'var(--brake)',
  shoulder: 'var(--ink)',
  hip: 'var(--faint)',
  text2: 'var(--text-2)',
  ball: 'var(--ball)',
  outline: 'var(--ink)',
};

const f = (v: number): string => v.toFixed(1);
const line = (a: Projected, b: Projected, col: string, w: number, op = 1): string =>
  `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round"${op < 1 ? ` stroke-opacity="${op.toFixed(2)}"` : ''}/>`;
const points = (pts: readonly Projected[]): string => pts.map((v) => `${f(v[0])},${f(v[1])}`).join(' ');

export function renderFigure(pose: Pose, j: Joints, cam: Camera2D, o: FigureOptions = {}): string {
  const pr = projector(cam);
  const s = cam.scale;
  const a = pose.a;
  const items: { d: number; svg: string }[] = [];
  const limb = (p: Vec3, q: Vec3, col: string, w: number, act: number, brake: number) => {
    const A = pr(p);
    const B = pr(q);
    let svg = line(A, B, col, w * s);
    if (act > 0.03) svg += line(A, B, C.signal, w * s, Math.min(1, act));
    if (brake > 0.03) svg += line(A, B, C.brake, w * s, Math.min(1, brake));
    items.push({ d: (A[2] + B[2]) / 2, svg });
  };

  limb(j.hipL, j.kneeL, C.far, 4.4, a[0], 0);
  limb(j.kneeL, j.footL.ankle, C.far, 4, a[0], 0);
  limb(j.footL.heel, j.footL.toe, C.far, 3.2, 0, 0);
  limb(j.hipR, j.kneeR, C.near, 4.4, a[0], 0);
  limb(j.kneeR, j.footR.ankle, C.near, 4, a[0], 0);
  limb(j.footR.heel, j.footR.toe, C.near, 3.2, 0, 0);

  {
    const q = [j.hipL, j.hipR, j.shoulderR, j.shoulderL].map(pr);
    const pts = points(q);
    let svg = `<polygon points="${pts}" fill="${C.fill}" stroke="${C.near}" stroke-width="${f(1.6 * s)}" stroke-linejoin="round"/>`;
    if (a[2] > 0.03) svg += `<polygon points="${pts}" fill="${C.signal}" fill-opacity="${(a[2] * 0.45).toFixed(2)}"/>`;
    svg += line(q[0], q[1], C.hip, 3.6 * s);
    if (a[1] > 0.03) svg += line(q[0], q[1], C.signal, 3.6 * s, a[1]);
    svg += line(q[3], q[2], C.shoulder, 3.2 * s);
    if (pose.br > 0.03) svg += line(q[3], q[2], C.brake, 3.2 * s, pose.br);
    items.push({ d: q.reduce((m, v) => m + v[2], 0) / 4, svg });
  }

  limb(j.chest, add(j.head, scale(j.torsoUp, -BODY.headRadius)), C.near, 3, 0, 0);
  {
    const H = pr(j.head);
    const N = pr(j.nose);
    items.push({ d: H[2], svg: `<circle cx="${f(H[0])}" cy="${f(H[1])}" r="${f(BODY.headRadius * s)}" fill="${C.fill}" stroke="${C.near}" stroke-width="${f(1.6 * s)}"/>` });
    items.push({ d: N[2] + 0.01, svg: `<circle cx="${f(N[0])}" cy="${f(N[1])}" r="${f(2 * s)}" fill="${C.near}"/>` });
  }

  const armL = o.bothArms ? a[3] : 0;
  const brakeL = o.bothArms ? pose.br : 0;
  limb(j.shoulderL, j.elbowL, C.far, 3.6, armL, brakeL);
  limb(j.elbowL, j.wristL, C.far, 3.2, armL, brakeL);
  limb(j.shoulderR, j.elbowR, C.near, 3.8, a[3], pose.br);
  limb(j.elbowR, j.wristR, C.near, 3.4, a[3], pose.br);

  {
    const A = pr(j.racket.butt);
    const B = pr(j.racket.throat);
    items.push({ d: (A[2] + B[2]) / 2, svg: line(A, B, C.near, 2.6 * s) });
  }
  {
    const q = j.racket.rim.map(pr);
    const pts = points(q);
    let svg = `<polygon points="${pts}" fill="${C.near}" fill-opacity="0.07" stroke="${C.near}" stroke-width="${f(1.7 * s)}" stroke-linejoin="round"/>`;
    if (a[4] > 0.03) svg += `<polygon points="${pts}" fill="none" stroke="${C.signal}" stroke-opacity="${Math.min(1, a[4]).toFixed(2)}" stroke-width="${f(1.9 * s)}" stroke-linejoin="round"/>`;
    items.push({ d: pr(j.racket.center)[2], svg });
  }
  if (o.ball) {
    const b = pr(o.ball.p);
    items.push({
      d: b[2] + 50,
      svg: `<circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(3.6 * s)}" fill="${C.ball}" stroke="${C.outline}" stroke-width="1" fill-opacity="${o.ball.opacity}" stroke-opacity="${o.ball.opacity}"/>`,
    });
  }

  items.sort((x, y) => x.d - y.d);

  let out = '';
  const g = pr([(pose.lf[0] + pose.rf[0]) / 2, (pose.lf[1] + pose.rf[1]) / 2, 0]);
  out += `<ellipse cx="${f(g[0])}" cy="${f(g[1])}" rx="${f(62 * s)}" ry="${f(11 * s)}" fill="${C.near}" fill-opacity="0.05"/>`;
  const wg = pr([pose.rf[0] + (pose.lf[0] - pose.rf[0]) * pose.w, pose.rf[1] + (pose.lf[1] - pose.rf[1]) * pose.w, 0]);
  out += `<circle cx="${f(wg[0])}" cy="${f(wg[1])}" r="${f(7 * s)}" fill="none" stroke="${C.near}" stroke-opacity="0.35" stroke-width="1"/><circle cx="${f(wg[0])}" cy="${f(wg[1])}" r="${f(3.2 * s)}" fill="${C.near}"/>`;
  if (o.path) out += `<polyline points="${points(o.path.map(pr))}" fill="none" stroke="${C.text2}" stroke-width="1" stroke-dasharray="3 4" stroke-opacity="0.7"/>`;
  if (o.trail && o.trail.length > 1) {
    for (let i = 1; i < o.trail.length; i++) out += line(pr(o.trail[i - 1]), pr(o.trail[i]), C.signal, 2.2, (i / o.trail.length) * 0.8);
  }
  out += items.map((x) => x.svg).join('');
  if (o.inset) out += inset(pose, o.inset, o.labels ?? { net: 'NET', separation: 'X' });
  return out;
}

function inset(p: Pose, o: NonNullable<FigureOptions['inset']>, labels: { net: string; separation: string }): string {
  const { cx, cy, r, big } = o;
  const fs = big ? 13 : 11;
  const rad = (d: number) => (d * Math.PI) / 180;
  const ln = (yaw: number, l: number) => [Math.cos(rad(yaw)) * l, Math.sin(rad(yaw)) * l];
  const h = ln(p.pel[3], r * 0.55);
  const sh = ln(p.tor[0], r * 0.8);
  const nz = [Math.sin(rad(p.hd)) * r * 0.2, -Math.cos(rad(p.hd)) * r * 0.2];
  const sep = Math.round(Math.abs(p.tor[0] - p.pel[3]));
  const kk = r / 60;
  let svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.hip}" stroke-width="0.8"/>`;
  for (const [q, solid] of [[p.lf, false], [p.rf, true]] as const) {
    const x = cx + (q[0] - p.pel[0]) * kk;
    const y = cy - (q[1] - p.pel[1]) * kk;
    svg += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.08)}" ry="${f(r * 0.19)}" transform="rotate(${f(q[2])} ${f(x)} ${f(y)})" fill="${solid ? C.text2 : 'none'}" stroke="${C.text2}" stroke-width="1"/>`;
  }
  svg += `<line x1="${f(cx - h[0])}" y1="${f(cy - h[1])}" x2="${f(cx + h[0])}" y2="${f(cy + h[1])}" stroke="${C.hip}" stroke-width="${big ? 5 : 3.5}" stroke-linecap="round"/>`;
  svg += `<line x1="${f(cx - sh[0])}" y1="${f(cy - sh[1])}" x2="${f(cx + sh[0])}" y2="${f(cy + sh[1])}" stroke="${C.shoulder}" stroke-width="${big ? 3.5 : 2.5}" stroke-linecap="round"/>`;
  svg += `<circle cx="${f(cx + sh[0])}" cy="${f(cy + sh[1])}" r="${big ? 4 : 2.8}" fill="${C.shoulder}"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.16)}" fill="${C.fill}" stroke="${C.near}" stroke-width="1"/><circle cx="${f(cx + nz[0])}" cy="${f(cy + nz[1])}" r="${big ? 2 : 1.5}" fill="${C.near}"/>`;
  svg += `<path d="M${cx - 4} ${cy - r - 5} L${cx} ${cy - r - 11} L${cx + 4} ${cy - r - 5}" fill="none" stroke="${C.text2}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  svg += `<text x="${cx + 8}" y="${cy - r - 5}" style="font-size:${fs}px;fill:${C.text2}">${labels.net}</text>`;
  svg += `<text x="${cx}" y="${cy + r + 15}" text-anchor="middle" style="font-size:${fs}px;fill:${C.text2}">${labels.separation} ${sep}°</text>`;
  return svg;
}
```

- [ ] **Step 3：写检查台页面** `dev/viewer.html`

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>动作模型检查台</title>
    <style>
      :root {
        --paper: #f1f3f5; --ink: #1d3f94; --text: #0e1b33; --text-2: #4a5a78; --faint: #9fb2cc;
        --signal: #ee4f17; --brake: #4c7bd9; --ball: #d4e84a;
        --fig-near: #1d3f94; --fig-far: #9fb2cc; --fig-fill: #ffffff;
      }
      body { margin: 0; padding: 16px; background: var(--paper); color: var(--text); font: 13px/1.5 -apple-system, "PingFang SC", sans-serif; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      .row { display: grid; grid-template-columns: 170px repeat(5, minmax(0, 1fr)); gap: 6px; align-items: end; margin-bottom: 10px; }
      .row svg, #big { width: 100%; background: #fff; border: 1px solid #d6dde7; border-radius: 6px; }
      .meta { color: var(--text-2); }
      #stage { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-top: 20px; align-items: start; }
      #panel label { display: block; margin-bottom: 8px; }
      #t { width: 100%; }
    </style>
  </head>
  <body>
    <h1>动作模型检查台（开发用）</h1>
    <div id="grid"></div>
    <div id="stage">
      <svg id="big" viewBox="0 0 654 380"></svg>
      <div id="panel">
        <label>击球 <select id="stroke"><option value="forehand">正手</option><option value="backhand">反手</option></select></label>
        <label>站位 <select id="stance"><option value="neutral">中性</option><option value="semi" selected>半开放</option><option value="open">开放</option></select></label>
        <label>时间 <input id="t" type="range" min="0" max="1220" value="0" /></label>
        <button id="play" type="button">播放（慢 5 倍）</button>
        <pre id="info" class="meta"></pre>
      </div>
    </div>
    <script type="module" src="/src/dev/viewer.ts"></script>
  </body>
</html>
```

- [ ] **Step 4：写检查台脚本** `src/dev/viewer.ts`

```ts
import {
  PHASES, SETS, STANCES, STROKES, chainCurves, getSet, peakTime, poseAt, racketSpeed, shoulderHipSeparation, solvePose,
  type Stance, type Stroke,
} from '../model';
import type { Vec3 } from '../model/vec';
import type { Camera2D } from '../render2d/project';
import { renderFigure } from '../render2d/stickFigure';

const THUMB: Camera2D = { phi: 30, elev: 12, scale: 0.8, cx: 112, groundY: 228 };
const BIG: Camera2D = { phi: 30, elev: 12, scale: 1.4, cx: 300, groundY: 360 };
const LABELS = { net: '球网', separation: '肩髋差' };
const NAME: Record<string, string> = { forehand: '正手', backhand: '反手', neutral: '中性', semi: '半开放', open: '开放' };

function swingPath(stroke: Stroke, stance: Stance): Vec3[] {
  const set = getSet(stroke, stance);
  const pts: Vec3[] = [];
  const t0 = set.times[1];
  const t1 = set.times[set.times.length - 1];
  for (let i = 0; i <= 160; i++) pts.push(solvePose(poseAt(set, t0 + ((t1 - t0) * i) / 160)).racket.center);
  return pts;
}

const grid = document.getElementById('grid')!;
for (const stroke of STROKES) {
  for (const stance of STANCES) {
    const set = SETS[stroke][stance];
    const path = swingPath(stroke, stance);
    const c = chainCurves(set, 300);
    const peaks = [c.pelvis, c.torso, c.arm, c.head].map((v) => peakTime(c.t, v).toFixed(3)).join(' / ');
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      `<div class="meta"><b>${NAME[stroke]} · ${NAME[stance]}</b><br>击球拍速 ${racketSpeed(set, set.times[set.contactIndex]).toFixed(1)} m/s` +
      `<br>引拍肩髋差 ${shoulderHipSeparation(poseAt(set, set.times[1])).toFixed(0)}°<br>峰值 ${peaks}</div>` +
      PHASES.map((_, i) => {
        const p = poseAt(set, set.times[i]);
        return `<svg viewBox="0 0 220 240">${renderFigure(p, solvePose(p), THUMB, { path, inset: { cx: 188, cy: 40, r: 22 }, labels: LABELS, bothArms: stroke === 'backhand' })}</svg>`;
      }).join('');
    grid.appendChild(row);
  }
}

const big = document.getElementById('big')!;
const strokeSel = document.getElementById('stroke') as HTMLSelectElement;
const stanceSel = document.getElementById('stance') as HTMLSelectElement;
const slider = document.getElementById('t') as HTMLInputElement;
const info = document.getElementById('info')!;
const playBtn = document.getElementById('play') as HTMLButtonElement;
let playing = false;
let last = 0;

function draw() {
  const stroke = strokeSel.value as Stroke;
  const stance = stanceSel.value as Stance;
  const set = getSet(stroke, stance);
  const t = Number(slider.value) / 1000;
  const p = poseAt(set, t);
  const j = solvePose(p);
  const trail: Vec3[] = [];
  for (let q = Math.max(0, t - 0.3); q <= t; q += 0.01) trail.push(solvePose(poseAt(set, q)).racket.center);
  big.innerHTML = renderFigure(p, j, BIG, {
    path: swingPath(stroke, stance), trail, inset: { cx: 590, cy: 70, r: 40, big: true }, labels: LABELS, bothArms: stroke === 'backhand',
  });
  info.textContent =
    `t = ${t.toFixed(3)} s\n拍速 ${racketSpeed(set, t).toFixed(1)} m/s\n肩髋差 ${shoulderHipSeparation(p).toFixed(0)}°\n` +
    `重心 左 ${(p.w * 100).toFixed(0)}%\n腿伸展 L ${j.reach.legL.toFixed(3)} R ${j.reach.legR.toFixed(3)}\n` +
    `臂伸展 L ${j.reach.armL.toFixed(3)} R ${j.reach.armR.toFixed(3)}\n握拍误差 ${j.gripError.toFixed(2)} cm`;
}

function tick(ts: number) {
  if (!playing) return;
  const dt = Math.min(50, ts - last) / 5;
  last = ts;
  slider.value = String((Number(slider.value) + dt) % 1221);
  draw();
  requestAnimationFrame(tick);
}

playBtn.onclick = () => {
  playing = !playing;
  last = performance.now();
  if (playing) requestAnimationFrame(tick);
};
for (const el of [strokeSel, stanceSel, slider]) el.oninput = draw;
draw();
```

- [ ] **Step 5：类型检查和测试**

Run: `npx tsc --noEmit && npx vitest run`
Expected：无类型错误，测试全部 PASS。

- [ ] **Step 6：启动开发服务器并目视检查**

用浏览器面板的 `preview_start` 启动（在 `.claude/launch.json` 里配置 `npm run dev`，端口 5173），打开 `http://localhost:5173/dev/viewer.html`，截图检查 6 行缩略图和大图：
  - 正手 3 行与原型网页的姿势一致（第 3 帧髋部更早转回是有意的改动）；
  - 反手 3 行：引拍时拍子在身体左后方、肩背部分朝网；击球点在身体左前方；随挥拍子收到右肩上方，两手都在拍柄上；中性站位右脚在前；
  - 发现不自然的姿势就回到 `backhand.ts` 调整（每次调整后重新运行 `npx vitest run`，保证约束测试仍然通过）。

- [ ] **Step 7：提交**

```bash
git add -A && git commit -m "2D 火柴人渲染器和动作模型检查台"
```

---

### Task 10：收尾与合并

- [ ] **Step 1：完整验证**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected：类型检查无错误，全部测试通过，构建成功。

- [ ] **Step 2：合并到 main**

```bash
git checkout main && git merge --no-ff m1-model -m "合并里程碑 1：动作模型" && git branch -d m1-model
```

- [ ] **Step 3：在品质日志里记一笔**

新建 `docs/quality-log.md`：

```markdown
# 品质日志

## 里程碑 1：动作模型（2026-10-02）

- 6 套动作（正手、双手反手 × 中性、半开放、开放）全部通过 6 条模型约束。
- 关键数字（模型示意值）：见检查台 `dev/viewer.html` 每行左侧。
- 尚未开始视觉评分（从里程碑 2 开始）。
```

把检查台里 6 行的"击球拍速 / 引拍肩髋差 / 峰值"实际数字填进第二条。

```bash
git add -A && git commit -m "品质日志：记录里程碑 1"
```
