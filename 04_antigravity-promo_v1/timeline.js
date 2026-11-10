// timeline.js — Single source of truth for picture, score, foley, subtitles, and cuecheck.
// 120 BPM · 4/4 · 24 fps → 1 beat = 0.500 s = 12 frames, 1 bar = 2.000 s = 48 frames, 24 bars = 48.000 s.

export const FPS = 24;
export const BPM = 120;
export const BEAT = 60 / BPM; // 0.500 s
export const BAR = BEAT * 4;  // 2.000 s
export const DUR = 48.0;      // 24 bars = 1152 frames

export const beatTime = (b) => +(b * BEAT).toFixed(6);

// Shot boundaries (every transition is a UI expand/collapse starting 1 frame = 1/24s before the beat)
export const SHOTS = [
  { id: 'S1_constant',  t0: 0.0,  t1: 4.5,  alt0: 0,   alt1: 0   },
  { id: 'S2_ground',    t0: 4.5,  t1: 11.0, alt0: 0,   alt1: 0   },
  { id: 'S3_ignition',  t0: 11.0, t1: 17.0, alt0: 0,   alt1: 120 },
  { id: 'S4_ascent',    t0: 17.0, t1: 27.0, alt0: 120, alt1: 600 },
  { id: 'S5_studio',    t0: 27.0, t1: 33.0, alt0: 600, alt1: 800 },
  { id: 'S6_zerog',     t0: 33.0, t1: 38.0, alt0: 800, alt1: 900 },
  { id: 'S7_orbit',     t0: 38.0, t1: 48.0, alt0: 900, alt1: 900 },
];

// Key synchronized audio-visual hits (0.000 ms lock between picture & score/foley)
export const CUES = {
  lock_9:        0.25,   // Beat 0.5 (frame 6)
  lock_dot1:     0.375,  // Beat 0.75 (frame 9)
  lock_8:        0.50,   // Beat 1.0 (frame 12)
  s1_collapse:   4.50,   // Beat 9
  freeze_start:  11.00,  // Beat 22 — Digital zero silence starts
  ignite_chime:  12.25,  // Beat 24.5 — First sound after silence + prism awakens
  console_open:  12.50,  // Beat 25 — Intent console expands
  exec_press:    16.00,  // Beat 32 — Caret strikes execute + rising light-horizon
  crane_ascent:  17.00,  // Beat 34 — Vertical crane ascent begins
  snap_grid:     22.00,  // Beat 44 — All 16 modules snap into 4x4 Zero-G Matrix on F# Maj9 chord
  studio_open:   27.00,  // Beat 54 — 2.5D studio panel opens + diagonal light sweep starts
  studio_dive:   32.75,  // Beat 65.5 — Exponential log-zoom dive into 0.0 G pill
  zerog_silence: 33.00,  // Beat 66 — Near-silence (-60 dB) starts
  lock_0a:       33.50,  // Beat 67.0 — Giant '0' locks
  lock_dot2:     33.625, // Beat 67.25 — Giant '.' locks
  lock_0b:       33.75,  // Beat 67.5 — Giant '0 G' locks
  orbit_open:    38.00,  // Beat 76 — Pull-out to wide panoramic orbital studio
  hero_sweep:    38.50,  // Beat 77 — Radial light sweep reveals 反重力 hero title
};

export const SILENCES = [
  { id: 'digital_zero', t0: 11.00, t1: 12.25, mode: 'zero' },
  { id: 'zerog_breath', t0: 33.00, t1: 33.50, mode: 'room' },
];

// Ground-gravity drops in Act I (0.0 – 11.0 s): every falling block lands on a musical grid subdivision!
// Accelerates from whole/half beats in S1 -> quarters -> eighths -> sixteenths in S2 (9.0–10.875 s).
export const DROP_BEATS = [
  // S1 background heavy drops (Beats 3, 5, 7)
  { id: 'd0', beat: 3.0,   col: 0, file: 'legacy_auth.ts',  err: '构建阻塞',   sev: 1 },
  { id: 'd1', beat: 5.0,   col: 2, file: 'webpack.cfg',     err: '依赖冲突',   sev: 1 },
  { id: 'd2', beat: 7.0,   col: 1, file: 'env_patch.sh',    err: '配置异常',   sev: 1 },
  // S2 quarter-note drops (Beats 10, 11, 12, 13)
  { id: 'd3', beat: 10.0,  col: 0, file: 'migration_04.sql',err: '合并锁死',   sev: 1 },
  { id: 'd4', beat: 11.0,  col: 3, file: 'session_pool.ts', err: '超时重试',   sev: 0 },
  { id: 'd5', beat: 12.0,  col: 1, file: 'ci_runner.yml',   err: '测试挂起',   sev: 1 },
  { id: 'd6', beat: 13.0,  col: 2, file: 'token_guard.ts',  err: '构建阻塞',   sev: 1 },
  // S2 eighth-note drops (Beats 14.0 .. 17.5)
  { id: 'd7', beat: 14.0,  col: 3, file: 'proxy_route.js',  err: '队列积压',   sev: 0 },
  { id: 'd8', beat: 14.5,  col: 0, file: 'schema_diff.json',err: '依赖冲突',   sev: 1 },
  { id: 'd9', beat: 15.0,  col: 2, file: ' manual_sync.sh', err: '手动切屏',   sev: 0 },
  { id: 'd10', beat: 15.5, col: 1, file: 'retry_queue.ts',  err: '超时重试',   sev: 1 },
  { id: 'd11', beat: 16.5, col: 3, file: 'lockfile_v2.json',err: '配置异常',   sev: 1 },
  { id: 'd12', beat: 17.5, col: 0, file: 'hotfix_19.patch', err: '合并锁死',   sev: 1 },
  // S2 voice-free crescendo: sixteenth/eighth burst (Beats 18.25 .. 21.5 = 9.125s .. 10.75s)
  { id: 'd13', beat: 18.25, col: 2, file: 'lint_err_41.log', err: '构建阻塞',  sev: 1 },
  { id: 'd14', beat: 18.75, col: 1, file: 'auth_mock.spec',  err: '测试挂起',  sev: 1 },
  { id: 'd15', beat: 19.25, col: 3, file: 'pkg_tree.lock',   err: '依赖冲突',  sev: 1 },
  { id: 'd16', beat: 19.75, col: 0, file: 'deploy_halt.sh',  err: '队列积压',  sev: 1 },
  { id: 'd17', beat: 20.25, col: 2, file: 'ctx_switch.tmp',  err: '手动切屏',  sev: 0 },
  { id: 'd18', beat: 20.50, col: 1, file: 'core_panic.log',  err: '构建阻塞',  sev: 1 },
  { id: 'd19', beat: 20.75, col: 3, file: 'port_bind.cfg',   err: '配置异常',  sev: 1 },
  { id: 'd20', beat: 21.00, col: 0, file: 'trace_dump.txt',  err: '超时重试',  sev: 1 },
].map((d, idx) => ({
  ...d,
  idx,
  tLand: beatTime(d.beat),
  tSpawn: +(beatTime(d.beat) - 0.36).toFixed(4),
}));

// Four vertical levitation pillars & 16 modules in S4 (17.0 – 27.0 s)
export const PILLARS = [
  { id: 0, code: '01', name: '感知', trail: '#6E9ECF', items: ['上下文索引', '依赖解析', '语义检索', '状态对齐'] },
  { id: 1, code: '02', name: '规划', trail: '#8E88E8', items: ['架构推演', '接口契约', '任务拆解', '路径择优'] },
  { id: 2, code: '03', name: '编码', trail: '#68B0A0', items: ['核心重构', '并发补全', '类型收敛', '无感修补'] },
  { id: 3, code: '04', name: '验证', trail: '#A4B2CC', items: ['回归校验', '安全审计', '基准压测', '轨道签发'] },
];

// Spoken lines + measured TTS durations (every toast hold >= speech_dur + 0.68 s and >= 1.8 s)
export const VOICES = [
  { id: 'L1', t0: 4.90,  dur: 3.361, toast0: 4.90,  toast1: 9.00,  dense: 1, text: '写不完的配置与排错，像引力把创造压向地面。' },
  { id: 'L2', t0: 12.65, dur: 3.314, toast0: 12.65, toast1: 16.65, dense: 0, text: '直到一句纯粹的意图，点燃反重力引擎。' },
  { id: 'L3', t0: 17.20, dur: 3.955, toast0: 17.20, toast1: 21.85, dense: 0, text: '繁重任务轻盈升空，多智能体在四条轨道并行编排。' },
  { id: 'L4', t0: 22.50, dur: 3.263, toast0: 22.50, toast1: 26.50, dense: 0, text: '每一次推演与修改，严丝合缝卡入秩序。' },
  { id: 'L5', t0: 27.40, dur: 3.642, toast0: 27.40, toast1: 31.80, dense: 0, text: '预判你的下一行脉络，让整座代码库悄然失重。' },
  { id: 'L6', t0: 38.80, dur: 4.339, toast0: 38.80, toast1: 43.90, dense: 0, text: '反重力。当工程摆脱引力，思想自由升空。' },
];

// External .srt cues (includes spoken toast lines; S3's typed command is visual context above L2)
export const SRT_CUES = VOICES.map(v => ({
  t0: v.toast0,
  t1: v.toast1,
  text: v.text,
}));
