import type { Dict } from './index';

const ready = { name: 'Ready', cue: 'Knees soft, weight on the balls of the feet' };
const readyBh = { name: 'Ready', cue: 'Knees soft, left hand on the throat' };

export const en: Dict = {
  stroke: { forehand: 'Forehand', backhand: 'Two-handed backhand' },
  stance: { neutral: 'Neutral', semi: 'Semi-open', open: 'Open' },
  view: { axo: 'Axonometric', front: 'Front', side: 'Side', top: 'Top', free: 'Free' },
  phase: {
    forehand: {
      neutral: {
        ready,
        backswing: { name: 'Turn & step', cue: 'Turn sideways, step the left foot toward the net' },
        drive: { name: 'Weight shift', cue: 'Like a throw: push from the back foot to the front' },
        contact: { name: 'Contact', cue: 'Contact out in front of the front foot' },
        finish: { name: 'Finish', cue: 'Weight on the left foot, right toe down' },
      },
      semi: {
        ready,
        backswing: { name: 'Unit turn', cue: 'Right foot planted behind, left foot ahead' },
        drive: { name: 'Drive', cue: 'Push forward and rotate at the same time' },
        contact: { name: 'Contact', cue: 'A little further forward than in open stance' },
        finish: { name: 'Finish', cue: 'Weight to the left foot, right heel up' },
      },
      open: {
        ready,
        backswing: { name: 'Unit turn', cue: 'Wring the towel: shoulders turn past the hips' },
        drive: { name: 'Drive', cue: 'Hips lead, racket head drops below the ball' },
        contact: { name: 'Contact', cue: 'Chest to the net, contact out to the side' },
        finish: { name: 'Finish', cue: 'Racket wraps the left shoulder; the back brakes' },
      },
    },
    backhand: {
      neutral: {
        ready: readyBh,
        backswing: { name: 'Turn & step', cue: 'Turn sideways, step the right foot toward the net' },
        drive: { name: 'Weight shift', cue: 'From the left foot to the right, hips lead' },
        contact: { name: 'Contact', cue: 'Both hands push through, in front of the right foot' },
        finish: { name: 'Finish', cue: 'Over the right shoulder, both hands stay on' },
      },
      semi: {
        ready: readyBh,
        backswing: { name: 'Unit turn', cue: 'Left foot planted behind, back turned to the net' },
        drive: { name: 'Drive', cue: 'Push off the left leg, hips open first' },
        contact: { name: 'Contact', cue: 'Chest to the net, both arms extend forward' },
        finish: { name: 'Finish', cue: 'Weight to the right foot, racket over the shoulder' },
      },
      open: {
        ready: readyBh,
        backswing: { name: 'Unit turn', cue: 'Load the left leg, shoulders turn past the hips' },
        drive: { name: 'Drive', cue: 'Drive and rotate off the left leg' },
        contact: { name: 'Contact', cue: 'Square to the net, contact in front' },
        finish: { name: 'Finish', cue: 'Wrap to the right shoulder; the back brakes' },
      },
    },
  },
  lab: {
    title: 'Lab',
    subtitle: 'Pick a stroke, a stance and a view, then scrub the timeline or press play.',
    stroke: 'Stroke',
    stance: 'Stance',
    view: 'View',
    speedLabel: 'Speed',
    timeline: 'Timeline',
    play: 'Play',
    pause: 'Pause',
    slow: 'Slow ×5',
    real: 'Real time',
    prev: 'Previous keyframe',
    next: 'Next keyframe',
    speed: 'Racket-head speed',
    separation: 'Hip–shoulder separation',
    weight: 'Weight',
    left: 'L',
    right: 'R',
    modelNote: 'Model values',
    multiFront: 'Front',
    multiSide: 'Side',
    multiTop: 'Top',
    net: 'Net',
    keys: 'Space play · ← → keyframes · 1 2 3 stance · F B stroke · V view',
    fallback: 'Your browser can’t run 3D, so this is the 2D drawing.',
    stageLabel: '3D figure demonstrating the swing',
  },
};
