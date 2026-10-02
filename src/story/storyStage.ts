import { t, type Lang } from '../i18n';
import { getSet, poseAt, solvePose, type Pose, type Stance, type Stroke } from '../model';
import { renderFigure } from '../render2d/stickFigure';
import type { Stage } from '../render3d/stage';
import type { ViewSpec } from '../render3d/cameraRig';
import { chainState, updateChainFigure } from './chain';
import { blendStoryPose, phaseState, storyPose } from './phases';
import { focusIndex } from './progress';

type SlotName = 'cover' | 'chain' | 'forehand' | 'backhand';
interface StorySection {
  name: SlotName;
  el: HTMLElement;
  slot: HTMLElement;
  staticEl: HTMLElement | null;
  original: string;
  cards: HTMLElement[];
  stance: Stance;
  manual: number;
  position: number;
}
interface StanceTween { section: StorySection; from: Pose; start: number }
const phaseNames = ['ready', 'backswing', 'drive', 'contact', 'finish'] as const;
const groups = ['legs', 'hips', 'trunk', 'arm', 'head'] as const;

/** 仅露出边缘时先保留线稿；可检查的舞台至少有 70% 的可容纳面积进入视口。 */
export function stageVisibleEnough(rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>, viewportWidth: number, viewportHeight: number): boolean {
  const top = Math.min(80, viewportHeight * 0.15);
  const visibleWidth = Math.max(0, Math.min(viewportWidth, rect.right) - Math.max(0, rect.left));
  const visibleHeight = Math.max(0, Math.min(viewportHeight, rect.bottom) - Math.max(top, rect.top));
  const possible = Math.min(rect.width, viewportWidth) * Math.min(rect.height, viewportHeight - top);
  return possible > 0 && visibleWidth * visibleHeight >= possible * 0.7;
}

/** 一张 WebGL 画布按需迁移，页面其余位置一直保留构建时生成的静态图。 */
export async function mountStory(root: HTMLElement, lang: Lang, opts: { force2d: boolean }): Promise<{ dispose(): void }> {
  const sections = [...root.querySelectorAll<HTMLElement>('[data-story-slot]')].flatMap((slot): StorySection[] => {
    const el = slot.closest<HTMLElement>('section');
    const name = slot.dataset.storySlot as SlotName;
    if (!el || !['cover', 'chain', 'forehand', 'backhand'].includes(name)) return [];
    const staticEl = slot.querySelector<HTMLElement>('.static-stage');
    return [{ name, el, slot, staticEl, original: staticEl?.innerHTML ?? '', cards: [...el.querySelectorAll<HTMLElement>(name === 'chain' ? '.story-step[data-step]' : 'article[data-phase]')], stance: 'semi', manual: 0, position: 0 }];
  });
  if (!sections.length) return { dispose() {} };
  // 一次性增强全部阶段：画布迁移不得再改变卡片高度或页面锚点。
  root.classList.add('story-enhanced');

  let disposed = false;
  let stage: Stage | null = null;
  let pendingStage: Stage | null = null;
  let loaded = opts.force2d;
  let loading: Promise<void> | null = null;
  let active: StorySection | null = null;
  let raf = 0;
  let frameTime = 0;
  let coverTime = 0;
  let paused = false;
  let viewKey = '';
  let tween: StanceTween | null = null;
  let currentTime = 0;
  let fallbackKey = '';
  let hoveredPart: HTMLElement | null = null;
  let focusedPart: HTMLElement | null = null;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = media.matches;
  const off: (() => void)[] = [];
  const play = root.querySelector<HTMLButtonElement>('.cover-play');
  const listen = (el: EventTarget, name: string, handler: EventListener, options?: AddEventListenerOptions) => {
    el.addEventListener(name, handler, options);
    off.push(() => el.removeEventListener(name, handler, options));
  };

  function schedule(): void {
    if (!disposed && !document.hidden && !raf) raf = requestAnimationFrame(update);
  }
  function syncPlay(): void {
    if (!play) return;
    const running = !paused && !reduced;
    play.textContent = lang === 'zh' ? running ? '暂停演示' : '播放演示' : running ? 'Pause demo' : 'Play demo';
    play.setAttribute('aria-pressed', String(running));
    play.disabled = reduced;
    if (reduced) play.title = lang === 'zh' ? '已遵循系统的减少动态效果设置' : 'Reduced motion is enabled';
    else play.removeAttribute('title');
  }
  function syncStance(section: StorySection): void {
    section.el.dataset.currentStance = section.stance;
    for (const item of section.el.querySelectorAll<HTMLElement>('[data-stance-content]')) {
      item.hidden = item.dataset.stanceContent !== section.stance;
      item.classList.toggle('is-active', !item.hidden);
    }
    for (const button of section.el.querySelectorAll<HTMLButtonElement>('[data-story-stance]')) {
      button.setAttribute('aria-pressed', String(button.dataset.storyStance === section.stance));
    }
  }
  function syncPhase(section: StorySection, index: number): void {
    section.cards.forEach((card, i) => card.classList.toggle('is-active', i === index));
    for (const button of section.el.querySelectorAll<HTMLButtonElement>('[data-phase-step]')) {
      const isCurrent = Number(button.dataset.phaseStep) === index;
      button.setAttribute('aria-pressed', String(isCurrent));
    }
    const output = section.el.querySelector<HTMLElement>('[data-current-phase]');
    const value = section.name === 'chain'
      ? t(lang, `chain.steps.${groups[index]}.name`)
      : t(lang, `phase.${section.name}.${section.stance}.${phaseNames[index]}.name`);
    if (output && output.textContent !== value) output.textContent = value;
    section.el.dataset.activePhase = String(index);
  }
  function clearSlot(section: StorySection): void {
    section.slot.classList.remove('has-live-stage', 'has-stage', 'is-live-2d');
    section.el.classList.remove('is-story-active', 'has-story-3d');
    if (section.staticEl) {
      section.staticEl.hidden = false;
      section.staticEl.innerHTML = section.original;
    }
  }
  function setActive(next: StorySection | null): void {
    if (active === next) return;
    if (active) clearSlot(active);
    active = next;
    hoveredPart = null;
    const focused = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>('.story-step [data-emphasis]') : null;
    focusedPart = focused && next?.el.contains(focused) ? focused : null;
    tween = null;
    viewKey = '';
    fallbackKey = '';
    frameTime = 0;
    root.dataset.storySlot = next?.name ?? 'none';
    if (!next) { stage?.setActive(false); root.dataset.storyPlaying = 'false'; return; }
    next.el.classList.add('is-story-active');
    stage?.attach(next.slot);
    stage?.setActive(true);
    if (stage) {
      next.slot.classList.add('has-live-stage', 'has-stage');
      next.el.classList.add('has-story-3d');
      if (next.staticEl) next.staticEl.hidden = true;
    }
    void ensureStage();
  }
  async function ensureStage(): Promise<void> {
    if (loaded || loading || !active) return;
    if (!stageVisibleEnough(active.slot.getBoundingClientRect(), innerWidth, innerHeight)) return;
    root.dataset.storyRenderer = 'loading';
    loading = (async () => {
      let attempted = false;
      try {
        // force2d 在进入这里之前短路；低配/离线降级不要求下载 Three.js。
        const { createStage } = await import('../render3d/stage');
        if (disposed || !active) return;
        // 下载期间用户可能已滚走，等舞台再次可检查时再建立 GPU 资源。
        if (!stageVisibleEnough(active.slot.getBoundingClientRect(), innerWidth, innerHeight)) return;
        attempted = true;
        pendingStage = createStage(active.slot, {
          overlays: { floor: true, trail: true, path: false, markers: true, labels: true },
          label: (kind, value) => kind === 'speed'
            ? `${lang === 'zh' ? '模型拍速' : 'Model speed'} ${value.toFixed(1)} m/s`
            : `${lang === 'zh' ? '肩髋差' : 'Separation'} ${Math.round(value)}°`,
        });
        if (pendingStage) {
          pendingStage.setActive(false);
          await pendingStage.ready;
          if (disposed) { pendingStage.dispose(); pendingStage = null; return; }
          stage = pendingStage;
          pendingStage = null;
          stage.canvas.setAttribute('role', 'img');
          stage.canvas.setAttribute('aria-label', lang === 'zh' ? '网球挥拍示意模型，动作说明见相邻文字' : 'Illustrative tennis swing model. Details are in the adjacent text.');
          if (active) {
            stage.attach(active.slot);
            stage.setActive(true);
            active.slot.classList.add('has-live-stage', 'has-stage');
            active.el.classList.add('has-story-3d');
            if (active.staticEl) active.staticEl.hidden = true;
          }
        }
      } catch {
        // 留下可读、可操作的 SVG，模块下载失败也不抹掉正文或按钮。
        pendingStage?.dispose();
        pendingStage = null;
        attempted = true;
        root.dataset.storyFallback = 'load-error';
      } finally {
        loaded = attempted;
        loading = null;
        viewKey = '';
        fallbackKey = '';
        root.dataset.storyRenderer = stage ? '3d' : loaded ? '2d' : 'deferred';
        schedule();
      }
    })();
    await loading;
  }
  function selectSection(): StorySection | null {
    const viewport = window.innerHeight;
    const focus = viewport * 0.45;
    const candidates = sections.filter((section) => {
      const rect = section.el.getBoundingClientRect();
      const slot = section.slot.getBoundingClientRect();
      return rect.bottom > 80 && rect.top < viewport && slot.bottom > 0 && slot.top < viewport;
    });
    return candidates.find((section) => {
      const rect = section.el.getBoundingClientRect();
      return rect.top <= focus && rect.bottom >= focus;
    }) ?? candidates[0] ?? null;
  }
  function cardPosition(section: StorySection): number {
    if (reduced) return section.manual;
    const centers = section.cards.map((card) => { const r = card.getBoundingClientRect(); return r.top + r.height / 2; });
    // 手机上舞台占上半屏，文字的焦点落在下方；桌面在中线。
    return focusIndex(centers, innerHeight * (innerWidth < 600 ? 0.77 : 0.52));
  }
  function drawFallback(section: StorySection, pose: Pose, emphasis: number | null): void {
    if (!section.staticEl) return;
    const key = `${section.name}:${section.stance}:${currentTime.toFixed(3)}:${emphasis}:${tween ? 'tween' : ''}`;
    if (key === fallbackKey && !tween) return;
    fallbackKey = key;
    section.slot.classList.add('is-live-2d');
    const figure = renderFigure(pose, solvePose(pose), { phi: 32, elev: 16, scale: 1.75, cx: 300, groundY: 360 }, { bothArms: section.name === 'backhand' });
    section.staticEl.innerHTML = `<svg viewBox="0 0 600 420" role="img" aria-label="${lang === 'zh' ? '挥拍模型：二维轴测示意' : 'Swing model: 2D axonometric view'}">${figure}</svg>`;
  }
  function partEmphasis(element: HTMLElement | null): number | null {
    if (!element || !active?.el.contains(element) || element.closest('[hidden]')) return null;
    const value = Number(element.dataset.emphasis);
    return Number.isInteger(value) && value >= 0 && value <= 4 ? value : null;
  }
  function update(now: number): void {
    raf = 0;
    if (disposed || document.hidden) return;
    setActive(selectSection());
    if (!active) return;
    void ensureStage();
    const section = active;
    const dt = frameTime ? Math.min(0.05, (now - frameTime) / 1000) : 0;
    frameTime = now;
    let stroke: Stroke = section.name === 'backhand' ? 'backhand' : 'forehand';
    let view: ViewSpec = { azimuth: 32, elevation: 16, zoom: 1 };
    let emphasis: number | null = null;
    let key = section.name as string;
    if (section.name === 'cover') {
      if (!paused && !reduced && loaded) coverTime = (coverTime + dt) % 7.1;
      currentTime = reduced ? 0.8 : Math.min(1.22, coverTime / 5);
    } else if (section.name === 'chain') {
      section.position = cardPosition(section);
      const state = chainState(section.position / 4);
      currentTime = state.time;
      emphasis = state.group;
      view = { azimuth: 90, elevation: 3, zoom: 1 };
      syncPhase(section, state.group);
      updateChainFigure(section.el, currentTime, state.group);
    } else {
      stroke = section.name;
      section.position = cardPosition(section);
      const state = phaseState(section.position, stroke, section.stance);
      currentTime = state.time;
      // 减少动态效果时保留固定轴测；点击只改变关键帧，不旋转镜头。
      if (!reduced) view = state.view;
      key += `:${reduced ? 'static' : state.index}`;
      syncPhase(section, state.index);
    }
    // 标签高亮优先于滚动强调；滚动更新不会冲掉仍在悬停/聚焦的部位。
    emphasis = partEmphasis(hoveredPart) ?? partEmphasis(focusedPart) ?? emphasis;
    root.dataset.storyEmphasis = emphasis === null ? 'none' : String(emphasis);
    const playing = section.name === 'cover' && !paused && !reduced && loaded;
    root.dataset.storyTime = currentTime.toFixed(3);
    root.dataset.storyReducedMotion = String(reduced);
    root.dataset.storyPlaying = String(playing);
    let pose = poseAt(getSet(stroke, section.stance), currentTime);
    if (tween?.section === section) {
      const k = Math.min(1, (now - tween.start) / 420);
      pose = blendStoryPose(tween.from, pose, k * k * (3 - 2 * k));
      if (k >= 1) tween = null;
    }
    if (stage) {
      stage.setMotion(stroke, section.stance);
      stage.setTime(currentTime);
      stage.setPose(tween ? pose : null);
      stage.setEmphasis(emphasis);
      stage.setPlaying(playing);
      if (key !== viewKey) { stage.setViewSpec(view, !reduced && viewKey !== ''); viewKey = key; }
      stage.canvas.dataset.time = currentTime.toFixed(3);
      stage.canvas.dataset.stroke = stroke;
      stage.canvas.dataset.stance = section.stance;
    } else if (loaded || loading) {
      if (emphasis !== null) pose = { ...pose, a: [0, 1, 2, 3, 4].map((i) => i === emphasis ? 1 : 0) as unknown as Pose['a'], br: 0 };
      drawFallback(section, pose, emphasis);
    }
    if (playing || tween) schedule();
  }

  sections.forEach((section) => {
    if (section.name === 'forehand' || section.name === 'backhand') syncStance(section);
    const findPart = (target: EventTarget | null): HTMLElement | null => {
      const part = target instanceof Element ? target.closest<HTMLElement>('.story-step [data-emphasis]') : null;
      return part && section.el.contains(part) ? part : null;
    };
    listen(section.el, 'pointerover', ((event: PointerEvent) => {
      if (active !== section) return;
      const part = findPart(event.target);
      if (part && hoveredPart !== part) { hoveredPart = part; schedule(); }
    }) as EventListener);
    listen(section.el, 'pointerout', ((event: PointerEvent) => {
      if (active !== section || !hoveredPart || findPart(event.target) !== hoveredPart) return;
      const next = findPart(event.relatedTarget);
      if (next !== hoveredPart) { hoveredPart = next; schedule(); }
    }) as EventListener);
    listen(section.el, 'focusin', ((event: FocusEvent) => {
      if (active !== section) return;
      const part = findPart(event.target);
      if (focusedPart !== part) { focusedPart = part; schedule(); }
    }) as EventListener);
    listen(section.el, 'focusout', ((event: FocusEvent) => {
      if (active !== section || !focusedPart || findPart(event.target) !== focusedPart) return;
      focusedPart = findPart(event.relatedTarget);
      schedule();
    }) as EventListener);
    listen(section.el, 'click', ((event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const stanceButton = target?.closest<HTMLElement>('[data-story-stance]');
      if (stanceButton && (section.name === 'forehand' || section.name === 'backhand')) {
        const next = stanceButton.dataset.storyStance as Stance;
        if (['neutral', 'semi', 'open'].includes(next) && next !== section.stance) {
          const from = storyPose(section.name, section.stance, phaseState(section.position, section.name, section.stance).time);
          tween = !reduced && active === section ? { section, from, start: performance.now() } : null;
          section.stance = next;
          syncStance(section);
          schedule();
        }
      }
      const phaseButton = target?.closest<HTMLElement>('[data-phase-step]');
      if (phaseButton) {
        section.manual = Math.max(0, Math.min(4, Number(phaseButton.dataset.phaseStep)));
        const card = section.cards[section.manual];
        if (card) {
          const rect = card.getBoundingClientRect();
          window.scrollTo({ top: window.scrollY + rect.top + rect.height / 2 - innerHeight * (innerWidth < 600 ? 0.77 : 0.52), behavior: reduced ? 'instant' : 'smooth' });
        }
        schedule();
      }
    }) as EventListener);
    if (section.name === 'chain') section.cards.forEach((card, index) => {
      // 整张卡不伪装成按钮，在卡片内加入原生按钮供减少动态效果/键盘使用。
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chain-step-button';
      button.textContent = lang === 'zh' ? `查看${t(lang, `chain.steps.${groups[index]}.name`)}` : `View ${t(lang, `chain.steps.${groups[index]}.name`)}`;
      button.dataset.phaseStep = String(index);
      card.append(button);
      off.push(() => button.remove());
    });
  });
  if (play) listen(play, 'click', (() => { paused = !paused; syncPlay(); schedule(); }) as EventListener);
  listen(window, 'scroll', schedule, { passive: true });
  listen(window, 'resize', schedule, { passive: true });
  listen(document, 'visibilitychange', (() => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; frameTime = 0; stage?.setActive(false); }
    else { stage?.setActive(!!active); schedule(); }
  }) as EventListener);
  listen(media, 'change', (() => {
    reduced = media.matches;
    tween = null;
    viewKey = '';
    frameTime = 0;
    sections.forEach((section) => { section.manual = Math.round(section.position); });
    syncPlay();
    schedule();
  }) as EventListener);
  syncPlay();
  root.dataset.storyRenderer = opts.force2d ? '2d' : 'deferred';
  schedule();
  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      off.forEach((dispose) => dispose());
      stage?.dispose();
      pendingStage?.dispose();
      sections.forEach(clearSlot);
      sections.forEach((section) => section.el.querySelectorAll<HTMLElement>('[data-stance-content]').forEach((item) => { item.hidden = false; }));
      delete root.dataset.storySlot;
      delete root.dataset.storyRenderer;
      delete root.dataset.storyEmphasis;
      root.classList.remove('story-enhanced');
    },
  };
}
