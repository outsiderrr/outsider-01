# outsider-01 项目简报（给接手的 AI 会话读）

> 新会话请先读完本文件，再读 `docs/superpowers/specs/2026-10-02-outsider-01-design.md`（已批准的设计方案）和当前里程碑的计划。

## 1. 这是什么

一个公开的中英双语单页网站，暂定名"网球挥拍实验报告"（英文 A Tennis Swing Lab Report），项目代号 `outsider-01`，**暂无正式站名**（用户明确说先不起名）。

- 内容：右手持拍的**正手**与**双手反手**，各三种站位（中性站位、半开放式、开放式），每种五个阶段（准备 / 引拍 / 蹬地转髋或重心前移 / 击球 / 随挥）。
- 形式：可旋转视角的 3D 线稿人偶 + 滚动叙事 + 可自由操作的"实验室"。
- 视觉方向（用户选定）："实验报告"——浅色是冷白网格纸 + 蓝墨线 + 信号橙，深色自动变成"蓝图纸"。
- 品质目标：Awwwards / Webby / FWA 获奖作品水准；按设计方案第 12 节的评分表反复自查，直到达标。
- 发布：GitHub Pages（仓库 `outsiderrr/outsider-01`，公开）。**创建公开仓库、推送、开启 Pages 之前必须先征得用户同意。**

## 2. 和用户合作的规矩（必读）

- **用户看不懂英文：所有回复、总结、提问一律用中文。**专有名词可以括号附英文，不要整段英文。
- 用户是网球初学者（右手持拍），健康安全是高优先事项，但**不要特殊化强调某个身体部位**，用"伤病风险优先于力量和球速"这类通用说法。
- 用户希望你自主推进、反复自查；只有真正需要他拍板的事（发布、范围变化）才问，问的时候给选项和推荐。
- Git 习惯：一个开发单元完成并验证通过就提交；每个里程碑在自己的分支上做，完成后 `git merge --no-ff` 合到 `main` 并删除分支（目前没有远程仓库）。提交信息用中文。
- **提交前测试必须真的通过**：先单独运行 `npx tsc --noEmit` 和 `npx vitest run`，看到全部通过再提交（不要把 commit 接在 `grep` 后面，grep 的退出码会掩盖测试失败——这个坑踩过一次）。

## 3. 参考资料

- 用户在读的书：《网球运动系统训练》（Tennis Anatomy 中文版，作者 E. Paul Roetert、Mark S. Kovacs）。书里正手（图 1.5）、单手反手（图 1.6）、双手反手（图 1.7）几页的照片用户发过，要点已经吸收进文案。
- 版权原则：**不复制书中插图，不大段转述原文**，用自己的话讲并注明出处。出版社、译者、年份等书目信息**发布前要向用户要版权页照片核对**（还没拿到）。
- 早期原型：`reference/prototype-forehand.html`（正手三种站位的 2D 火柴人网页，已被新代码取代，仅作对照）。

## 4. 进度

| 里程碑 | 状态 | 说明 |
|---|---|---|
| 1 动作模型 | ✅ 已合并到 main | 6 套动作（2 击球 × 3 站位）通过 6 条模型约束 |
| 2 3D 人偶与实验室 | ✅ 已合并到 main | `lab.html` 可用；第 0 轮自查已记录 |
| 3 章节与内容 | ✅ 已完成，合并到 main | 九节双语、共享舞台、降级及第 1 轮复验 |
| 4 视觉打磨、动效、无障碍、性能 | 🚧 进行中，分支 `m4-polish` | 优先三维初始化阻塞与视觉层级 |
| 5 品质自查循环至达标 | 未开始 | 达标线见设计方案第 12 节 |
| 6 发布到 GitHub Pages | 未开始 | 发布前问用户 |

### 里程碑 3 已完成
- `src/story/progress.ts`：滚动进度工具（`sectionProgress`、`stepAt`、`focusIndex`、`timeAlong`），有测试。
- `src/i18n/zh.ts`、`en.ts`：**全站文案已写完**（site、cover、abstract、chain、stances、phases、conclusion、notes、footer），两种语言键完全一致（`tests/i18n.test.ts` 保证）。

- 下方原任务清单已全部实现；保留作为接手时的实现约定。类型检查、126 项测试与生产构建通过。第 1 轮及修复后各 96 张浏览器截图、降级与交互验证记录见品质日志。
- 模型数字明确为示意值，不是普遍动作标准。字体子集和许可证自托管，新增中文后运行 `scripts/subset-fonts.py` 并通过覆盖测试。
- 下一步：修复首次三维渲染的长任务；减弱网格、明确图编号、补两语言分享图；独立测 Lighthouse 与实际绘制帧率；重新做 8 组逐节视觉自查。

### 里程碑 3 原任务清单（已完成，详见 `docs/superpowers/plans/2026-10-02-m3-site-content.md`）
1. **构建时生成页面**：写 `vite-plugin-site.ts` + `src/site/template.ts`（纯函数：语言 → 整页 HTML），注入 `index.html`（中文）和 `en/index.html`（英文，需新建）中的 `<!--site-->` 占位；开发时用 `server.ssrLoadModule` 热加载模板。不执行 JS 也要能读到全部文字。每个语言页独立的 title、description、`lang`、`hreflang`、`canonical`。语言切换用相对链接（中文页 → `en/`，英文页 → `../`），JS 负责保留当前锚点。
2. **文案里的占位符**要在模板里用模型数据替换：`{tor}`（引拍时躯干转角）、`{pel}`（骨盆转角）、`{sep}`（肩髋差）、`{pelvis}` `{torso}` `{arm}`（发力链峰值时刻，秒）、`{speed}`（拍头峰值速度 m/s）。反手的角度取绝对值。数据来源：`poseAt(set, set.times[1])`、`chainCurves(set)` + `peakTime`、`racketSpeed`。
3. **共用 3D 舞台**：给 `createStage` 增加 `attach(container)`（把画布和标签层移到新容器并重新监听尺寸）、`setActive(on)`（离开视口停止渲染）、`setEmphasis(组序号 | null)`（图 01 只高亮发力链中的一节）；`CameraRig` 增加 `setViewSpec(spec)`，以支持"后方轴测"（随挥阶段）等故事专用视角。封面、图 01、图 03、图 04 共用一个舞台；实验室单独一个，靠近视口才动态 `import()` 创建。
4. **各章节**：封面（超大标题、副标题、导语、样本/时长/关键阶段三项元信息、舞台慢速循环半开放式正手、开场动画）、摘要（三条要点 01–03）、图 01 鞭子原理（左侧 5 步卡片 + 右侧固定舞台 + 发力链曲线 SVG，随滚动推进 0.55→0.92 秒并高亮当前一节）、图 02 两种劲与三种站位（俯视脚印 SVG + 滑块在三种站位间插值 + 三项读数 + 对照表 + 什么时候用哪种）、图 03/04 五阶段滚动叙事（同一组件，参数是击球类型；站位切换；每阶段切换预设视角：准备=轴测，引拍=俯视，蹬地=侧视，击球=正视偏击球侧，随挥=后方轴测；卡片里放构建时生成的该阶段 SVG 线稿）、实验室（`mountLab`）、结论、注意事项与资料来源、页脚。页头：站点标识、目录（当前章节高亮；手机折叠）、语言切换、主题切换（跟随系统 / 浅 / 深）。
5. **降级与性能**：禁用 JS 时文字和静态线稿可读；`?force2d=1` 时所有 3D 位置换成 2D；3D 代码延后加载（当前 `lab` 代码块压缩后 170 KB，需拆分）。
6. **第 1 轮品质自查**：桌面 1440×900、手机 375×812 × 浅色 / 深色 × 中文 / 英文 逐节截图，按评分表打分，修掉 P0/P1，记入 `docs/quality-log.md`，然后合并 `m3-site` 到 main。

## 5. 运行与验证

```bash
cd /Users/outsider/通用空间/outsider-01
npm install            # 首次
npm run dev            # http://localhost:5173 ；实验室在 /lab.html ；动作检查台在 /dev/viewer.html
npx tsc --noEmit       # 类型检查（TypeScript 7）
npx vitest run         # 单元测试（当前 126 个，全部通过）
npx vite build         # 构建到 dist/（base 为 /outsider-01/）
```

- `lab.html?lang=en` 看英文；`lab.html?force2d=1` 看 2D 降级版。
- 视觉改动一定要在浏览器里截图检查（桌面 + 手机、浅色 + 深色）。

## 6. 代码地图与关键约定

```
src/model/        动作模型（纯函数，无 DOM）
  types.ts body.ts vec.ts          类型、人体与器材尺寸、向量运算
  keyframes/forehand.ts            正手 3 套关键帧（含共用的 READY 准备姿势）
  keyframes/backhand.ts            双手反手 = 正手镜像（mirror.ts）+ ADJUST 重设手和球拍
  interp.ts                        poseAt(set, t)：插值
  solve.ts                         solvePose(pose)：IK、踮脚、球拍几何、双手握拍
  metrics.ts                       shoulderHipSeparation、racketSpeed、chainCurves、peakTime
  index.ts                         SETS / getSet(stroke, stance) 等对外接口
src/render2d/     2D SVG 火柴人（降级版、静态线稿、检查台）
src/render3d/     Three.js：stage.ts（舞台总装）、mannequin.ts（人偶，可扭转躯干）、materials.ts（自定义着色器）、
                  racket/ball/trail/annotations/labels、cameraRig.ts（视角预设）、quality.ts（画质分档）、palette.ts（读 CSS 变量）
src/sections/lab/ 实验室界面 mountLab(root, lang, { force2d })
src/story/        共享故事舞台、发力链、五阶段滚动叙事、站位插值与进度工具
src/site/         双语静态页面模板、模型线稿与图表
scripts/          字体子集、真实浏览器截图、交互、体积预算与帧率检查
src/i18n/         t(lang, 'a.b.c')；zh.ts / en.ts 结构必须一致
src/styles/       tokens.css（两套主题令牌）、base.css、controls.css（分段按钮等）、fonts.css（自托管字体）
src/ui/theme.ts   主题：initTheme / setThemeChoice / nextChoice；切换时派发 window 的 themechange 事件
tests/            Vitest
docs/             设计方案、各里程碑计划、品质日志
```

**动作模型约定**
- 模型坐标：厘米，x 指向球员右侧，y 指向球网，z 向上。Three 坐标：米，y 向上，z 指向底线后方（`render3d/space.ts` 的 `toThree`）。
- 关键帧时间固定为 `[0, 0.55, 0.8, 0.92, 1.22]` 秒，序号 3 是击球。
- 插值：身体用三次 Hermite（三点抛物线切线）；**"击球保速"规则只用于手 `rh` 和球拍 `rk`**，所以身体先于手臂减速（发力链）；脚、发力标记、重心、握拍参数用 smoothstep；迈步的脚有抬脚弧线；踮脚是脚绕脚尖转。
- `tests/constraints.test.ts` 的 6 条约束（无折角、拍速峰值贴近击球、骨盆→躯干→手臂→拍头依次达峰、脚不打滑、骨段长度恒定且腿够得着地、双手不脱手）**任何改动后都必须保持全绿**。
- 改关键帧后用 `/dev/viewer.html` 目视检查 6 套动作。

**3D 约定**
- 人偶材质是自定义着色器：亮面 / 暗面两色 + 暗面屏幕空间排线；描边是"反面外扩"网格，所有描边共用一个 `OUTLINE_WIDTH` uniform，每个视图绘制前按"像素宽 × 每像素世界长度"更新（三视图小窗各自更新）。
- 发力橙 / 刹车蓝的着色强度按主题不同（`uTintMax`：浅色 0.48，深色 0.28）。
- 舞台按需渲染（时间、视角、尺寸、主题变化才重画）；画质分档 + 帧率监控自动降档。
- 颜色一律从 CSS 变量读取（`readPalette()`），主题切换时同步。

## 7. 已知问题与待办（里程碑 4/5 处理）
- 三维代码已动态拆分；入口 13.7 KB / 全部 184.8 KB gzip，预算通过；首次绘制仍有长任务。
- 深色模式发力色可能仍偏重；腰部色带已缓解，需在全站语境下复查。
- 人偶在舞台里略小、地面注释字号偏小。
- Lighthouse 预检性能 53、其余 100，LCP 4.0 秒，未达标；最终要独立测量并记录设备环境。目标：移动端性能 ≥ 85、LCP ≤ 2.5 秒，其余 ≥ 95；桌面 60 帧、手机 ≥ 30 帧。桌面手机视口不能冒充真机。
- 书目信息（出版社、年份、译者）待用户提供版权页核对。

## 8. 发布（里程碑 6，先问用户）
- 建公开仓库 `outsiderrr/outsider-01`（本机 `gh` 已登录 outsiderrr），推送 main，用 GitHub Actions 构建并发布到 Pages；网址 `https://outsiderrr.github.io/outsider-01/`，英文版 `/en/`。
- 提醒用户：国内不开 VPN 可能访问慢；以后可绑定自有域名。
