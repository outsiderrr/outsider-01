# 里程碑 3：章节与内容 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：**组装完整的中英双语单页网站：封面、摘要、图 01 鞭子原理、图 02 两种劲与三种站位、图 03 正手五阶段、图 04 双手反手五阶段、实验室、结论、注意事项与资料来源、页脚；页头有目录、语言切换、主题切换。

**架构：**
- 页面文字在**构建时**由 `src/site/template.ts` 生成，并由 Vite 插件注入 `index.html`（中文）和 `en/index.html`（英文）；不执行 JavaScript 也能读到全部文字，每个阶段配一张构建时生成的 SVG 线稿。
- 运行时 `src/main.ts` 只负责交互：主题与语言切换、滚动叙事、按需加载 3D。
- **共用画布：**封面、图 01、图 03、图 04 共用一个 3D 舞台（`StoryStage`），滚到哪一节就把画布移到哪一节的固定位；实验室单独一个舞台，靠近视口时才创建。离开视口的舞台暂停渲染。
- **滚动：**用浏览器原生滚动加 `position: sticky`，按章节滚动进度计算动作时间和当前步骤；不引入 GSAP / Lenis（与规格第 9 节相比的调整：同样效果、更少依赖、对读屏和键盘更友好）。
- **代码拆分：**3D 相关代码用动态 `import()` 延后加载，首屏只加载文字、样式和小脚本。

**技术栈：**沿用里程碑 1、2。

**写法说明：**同里程碑 2——纯逻辑（滚动进度换算、步骤定位、站位插值、模板生成）先写测试；版式和动效以截图迭代。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `vite-plugin-site.ts` | 构建 / 开发时调用模板生成两种语言的页面 HTML |
| `index.html`、`en/index.html` | 两个入口外壳（`<!--site-->` 占位由插件替换） |
| `src/site/template.ts` | 整页 HTML 模板（纯函数：语言 → HTML 字符串） |
| `src/site/figures.ts` | 构建时生成的 SVG：各阶段线稿、发力链曲线、站位脚印 |
| `src/i18n/zh.ts`、`en.ts` | 扩充为全站文案 |
| `src/main.ts` | 运行时入口 |
| `src/ui/header.ts` | 页头：目录高亮、语言切换（保持锚点）、主题切换 |
| `src/story/progress.ts` | 滚动进度与步骤定位（纯函数 + 监听） |
| `src/story/storyStage.ts` | 共用 3D 舞台在各章节之间移动 |
| `src/story/chain.ts` | 图 01：滚动驱动的发力链 |
| `src/story/stances.ts` | 图 02：脚印图与滑块 |
| `src/story/phases.ts` | 图 03 / 图 04：五阶段滚动叙事 |
| `src/styles/site.css` | 全站版式 |
| `tests/progress.test.ts`、`tests/template.test.ts`、`tests/stances.test.ts` | 纯逻辑测试 |

---

### Task 1：构建时生成页面 + 页头页脚 + 两种语言入口
- 插件在 `transformIndexHtml` 里把 `<!--site-->` 替换为 `renderPage(lang)` 的结果；开发时用 `server.ssrLoadModule` 加载模板以便热更新。
- 页面骨架：`header`（站点标识、目录、语言、主题）、`main` 下 9 个 `section`（锚点见规格第 4 节）、`footer`。
- 每个语言页有独立的 `<title>`、描述、`lang`、`hreflang`、`canonical`。
- 测试 `tests/template.test.ts`：两种语言都包含 9 个章节锚点；`lang` 属性正确；中文页不含英文正文段落、英文页不含中文正文（抽查标题）。
- 验收：`npm run dev` 打开 `/` 和 `/en/` 都能看到完整文字（禁用 JavaScript 也可）。

### Task 2：全站文案（中英文）
扩充 `zh.ts` / `en.ts`：`site.*`（标题、描述、导航）、`cover.*`、`abstract.*`（三条要点）、`chain.*`（5 步 + 图注 + 曲线标签）、`stances.*`（两种劲、三种站位、对照表、什么时候用哪种）、`phases.*`（每阶段的比喻与关键动作，按击球 × 站位）、`conclusion.*`、`notes.*`（安全提示、免责声明、资料来源）、`footer.*`。i18n 测试继续保证两种语言键一致。

### Task 3：滚动进度工具（先写测试）
```ts
/** 元素在视口中滚动的进度：元素顶部到达视口顶部时为 0，元素底部到达视口底部时为 1 */
export function sectionProgress(top: number, height: number, viewport: number): number;
/** 把 0..1 的进度分成 n 步：返回当前步序号和步内进度 */
export function stepAt(progress: number, n: number): { index: number; local: number };
```
测试：边界与中间值；`stepAt(1, 5)` 返回最后一步、步内进度 1。

### Task 4：共用 3D 舞台
- `createStage` 增加 `attach(container)`（移动画布与标签层、重新监听尺寸）、`setActive(on)`（离开视口时停止渲染）、`setEmphasis(group | null)`（图 01 只高亮发力链中的某一节）。
- `StoryStage`：懒加载（动态 `import`），在章节的 `.stage-slot` 之间移动画布；当前章节决定动作、视角、注释开关与时间。

### Task 5：封面与摘要
- 封面：超大标题"网球挥拍实验报告"（中文用思源黑体粗体，英文 IBM Plex Sans Condensed），副标题、一句导语、`FIG. 00` 编号；右侧（手机在下方）共用舞台慢速循环半开放式正手；开场动画：网格线画出 → 标题逐字出现（减少动态效果时直接显示）。
- 摘要：三条要点，每条一个小线稿图标（SVG），编号 01–03。

### Task 6：图 01 鞭子原理
- 版式：左侧 5 个步骤卡片（腿、髋、躯干、手臂、拍头），右侧固定的舞台（侧视）和发力链曲线图。
- 滚动进度 → 动作时间从 0.55 秒推进到 0.92 秒；当前步骤对应的身体部位高亮；曲线图随进度画出，并在峰值处标出时刻。
- 曲线数据来自 `chainCurves()`（模型示意值），四条曲线按各自峰值归一化。

### Task 7：图 02 两种劲与三种站位
- 俯视 SVG：两只脚印（引拍时与击球时两组，用实线 / 虚线区分）、肩线与髋线、击球点、重心移动箭头。
- 滑块在中性 → 半开放 → 开放之间连续插值（脚位、肩髋差、重心转移、击球点前后位置），正手 / 反手切换。
- 三项数字随滑块变化；下方是对照表（规格第 4 节第 3 行）。
- 纯逻辑测试 `tests/stances.test.ts`：滑块在 0 / 0.5 / 1 时分别等于中性 / 半开放 / 开放的模型数值。

### Task 8：图 03 / 图 04 五阶段滚动叙事
- 同一组件，参数是击球类型。每个阶段一屏高的文字卡片（阶段号、名称、比喻、关键动作、发力部位标签）；舞台固定在旁边。
- 阶段内滚动推进动作时间；每阶段切换到规格 7.1 的预设视角；顶部有站位切换按钮（切换时平滑过渡到同一阶段）。
- 每张卡片内有构建时生成的该阶段 SVG 线稿（无 JavaScript 或无 WebGL 时可见；有 3D 时在桌面隐藏）。

### Task 9：实验室接入
- `#lab` 章节内挂载 `mountLab`，靠近视口（提前 600 px）时才动态加载并创建。

### Task 10：结论、注意事项、资料来源、页脚
- 结论：正手、反手各一张"什么时候用哪种站位"对照表。
- 注意事项：随挥做完、步子别太大、量力而行（通用说法）；免责声明。
- 资料来源：参考书目（出版信息在发布前核对）；本站数字为模型示意值的说明。
- 页脚：项目代号、源代码链接（发布后填仓库地址）、语言切换。

### Task 11：降级与性能检查
- 禁用 JavaScript：全部文字和静态线稿可读。
- `?force2d=1`：所有 3D 位置换成 2D 线稿。
- 首屏只加载必要资源（3D 代码在滚动到第一个 3D 区域或封面渲染后才加载）。

### Task 12：第 1 轮品质自查
- 截图：桌面 1440×900、手机 375×812 × 浅色、深色 × 中文、英文，逐节检查。
- 按规格第 12 节打分，修掉 P0、P1，记入品质日志；`tsc`、测试、构建全部通过；合并到 main。
