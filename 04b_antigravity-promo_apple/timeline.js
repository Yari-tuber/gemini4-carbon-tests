// timeline.js — Single source of truth for 《Google Antigravity — 让创造，脱离引力》 (60.00 s, 2560x1440 @ 60 fps, 120 BPM)
export const WIDTH = 2560;
export const HEIGHT = 1440;
export const FPS = 60;
export const BPM = 120;
export const BEAT = 60 / BPM; // 0.50 s = 30 frames exact
export const BAR = BEAT * 4;  // 2.00 s = 120 frames exact
export const BARS = 30;
export const DUR = BARS * BAR; // 60.00 s = 3600 frames exact

export const SHOTS = [
  { id: 'S1',   t0: 0.00,  t1: 6.50,  theme: 'light', name: 'Porcelain Liftoff & Official Lockup' },
  { id: 'S2',   t0: 6.50,  t1: 13.50, theme: 'light', name: 'Natural Language Intent Composer' },
  { id: 'S3',   t0: 13.50, t1: 21.50, theme: 'light', name: 'Antigravity IDE Live Tab Flow' },
  { id: 'S4',   t0: 21.50, t1: 29.50, theme: 'light', name: 'Agent Manager & Parallel Subagents' },
  { id: 'TURN', t0: 29.50, t1: 30.50, theme: 'turn',  name: '1.0s Silence & Space Black Iris Flip' },
  { id: 'S5',   t0: 30.50, t1: 39.00, theme: 'dark',  name: 'Verifiable Artifacts & Live Browser Agent' },
  { id: 'S6',   t0: 39.00, t1: 46.50, theme: 'dark',  name: 'agy CLI, Python SDK & Marketplace' },
  { id: 'S7',   t0: 46.50, t1: 53.50, theme: 'light', name: 'Minimalist Apple 6-Card Bento' },
  { id: 'S8',   t0: 53.50, t1: 60.00, theme: 'light', name: 'Clean Gallery Finale Lockup' },
];

export const CUES = {
  logo_lock:     2.00,
  s2_cut:        6.50,
  prompt_send:  11.50,
  s3_cut:       13.50,
  tab_jump1:    16.00,
  tab_jump2:    18.50,
  s4_cut:       21.50,
  sub_spawn1:   22.50,
  sub_spawn2:   23.00,
  sub_spawn3:   23.50,
  cron_toggle:  26.00,
  silence_in:   29.50,
  pro_drop:     30.50,
  browser_in:   34.00,
  browser_click:36.00,
  s6_cut:       39.00,
  sdk_card_in:  40.50,
  mkt_card_in:  41.50,
  bento_cut:    46.50,
  bento_1:      46.75,
  bento_2:      47.00,
  bento_3:      47.25,
  bento_4:      47.50,
  bento_5:      47.75,
  bento_6:      48.00,
  finale_open:  53.50,
  finale_glint: 55.00,
};

export const SILENCES = [
  [29.50, 30.50],
];

// External SRT & Voice timings (burned-in small captions removed for minimalist restraint)
export const VOICES = [
  { id: 'L1', t0: 0.85,  dur: 4.68, toast0: 0.80,  toast1: 6.30,  text: '认识 Google Antigravity，为智能体时代重构的开发平台。' },
  { id: 'L2', t0: 7.00,  dur: 3.95, toast0: 6.90,  toast1: 13.10, text: '只需一句自然语言，你的意图即刻化为全局行动。' },
  { id: 'L3', t0: 14.00, dur: 5.55, toast0: 13.90, toast1: 20.90, text: '在 Antigravity IDE 中，Tab 键预判下一处脉络，让编码行云流水。' },
  { id: 'L4', t0: 22.00, dur: 5.10, toast0: 21.90, toast1: 28.90, text: '多路子智能体跨工作区并行探索，定时任务在后台全天值守。' },
  { id: 'L5', t0: 31.00, dur: 6.15, toast0: 30.90, toast1: 38.50, text: '从架构计划到走查报告，更有浏览器智能体亲自启动页面、实机验证。' },
  { id: 'L6', t0: 39.40, dur: 5.50, toast0: 39.30, toast1: 46.10, text: '从命令行工具、Python SDK，到开放的插件市场与 MCP 生态。' },
  { id: 'L7', t0: 47.10, dur: 5.10, toast0: 47.00, toast1: 53.20, text: 'Google Antigravity。当工程脱离引力，让创造自由升空。' },
];

export const BENTO_ITEMS = [
  { title: '多智能体协同', asset: 'subagents' },
  { title: '预测式编码',   asset: 'ide_editor' },
  { title: '浏览器自检',   asset: 'browser' },
  { title: '可审阅制品',   asset: 'ide_artifacts' },
  { title: '终端与 SDK',   asset: 'cli' },
  { title: '开放插件市场', asset: 'marketplace' },
];
