// Single source of truth for picture, HUD, karaoke words, SRT, score, and foley.
// 80 beats at 128.0 BPM = 37.500s exact -> musical bar 20 loops seamlessly into bar 0!
export const DUR = 37.50;
export const FPS = 30;
export const BPM = 128;
export const BEAT = 60 / BPM; // 0.46875s

export const LINES = [
  {
    id: 'l01', t0: 0.04,
    srt: 'Every Indian could stand inside one city.',
    words: ['EVERY', 'INDIAN', 'COULD', 'STAND', 'INSIDE', 'ONE', 'CITY']
  },
  {
    id: 'l02', t0: 3.15,
    srt: 'Over 1.4 billion people, packed two to a square meter, the safe limit at a concert,',
    words: ['OVER', '1.4', 'BILLION', 'PEOPLE', 'PACKED', 'TWO', 'TO', 'A', 'SQUARE', 'METRE', 'THE', 'SAFE', 'LIMIT', 'AT', 'A', 'CONCERT']
  },
  {
    id: 'l03', t0: 9.12,
    srt: 'fill a square just 27 kilometers wide.',
    words: ['FILL', 'A', 'SQUARE', 'JUST', 'TWENTY-SEVEN', 'KILOMETRES', 'WIDE']
  },
  {
    id: 'l04', t0: 12.24,
    srt: 'Pour it into Delhi, and it fills only half the city.',
    words: ['POUR', 'IT', 'INTO', 'DELHI', 'AND', 'IT', 'FILLS', 'ONLY', 'HALF', 'THE', 'CITY']
  },
  {
    id: 'l05', t0: 15.62,
    srt: 'The rest of India? Empty.',
    words: ['THE', 'REST', 'OF', 'INDIA?', 'EMPTY']
  },
  {
    id: 'l06', t0: 17.75,
    srt: 'Mumbai, Kolkata, Chennai — not a soul.',
    words: ['MUMBAI', 'KOLKATA', 'CHENNAI', 'NOT', 'A', 'SOUL']
  },
  {
    id: 'l07', t0: 20.65,
    srt: 'Now bring everyone on Earth, 8.2 billion.',
    words: ['NOW', 'BRING', 'EVERYONE', 'ON', 'EARTH', 'EIGHT', 'POINT', 'TWO', 'BILLION']
  },
  {
    id: 'l08', t0: 24.18,
    srt: 'The square grows to 64 kilometers.',
    words: ['THE', 'SQUARE', 'GROWS', 'TO', 'SIXTY-FOUR', 'KILOMETRES']
  },
  {
    id: 'l09', t0: 27.05,
    srt: 'Too big for Delhi, so fly it east into Sikkim,',
    words: ['TOO', 'BIG', 'FOR', 'DELHI', 'SO', 'FLY', 'IT', 'EAST', 'INTO', 'SIKKIM']
  },
  {
    id: 'l10', t0: 30.22,
    srt: "India's least populous state.",
    words: ["INDIA'S", 'LEAST', 'POPULOUS', 'STATE']
  },
  {
    id: 'l11', t0: 32.12,
    srt: 'It fits, with room to spare.',
    words: ['IT', 'FITS', 'WITH', 'ROOM', 'TO', 'SPARE']
  },
  {
    id: 'l12', t0: 34.06,
    srt: 'So next time someone says India is too crowded, tell them...',
    words: ['SO', 'NEXT', 'TIME', 'SOMEONE', 'SAYS', 'INDIA', 'IS', 'TOO', 'CROWDED', 'TELL', 'THEM']
  }
];

export const YELLOW_WORDS = new Set([
  'ONE', '1.4', 'BILLION', 'TWO', 'SAFE', 'CONCERT',
  'TWENTY-SEVEN', 'KILOMETRES', 'DELHI', 'HALF',
  'EMPTY', 'MUMBAI', 'KOLKATA', 'CHENNAI', 'SOUL',
  'EIGHT', 'SIXTY-FOUR', 'SIKKIM', 'LEAST', 'FITS', 'SPARE', 'CROWDED', 'TELL', 'THEM'
]);

// Top yellow HUD banners (each stays >= 2.3s for clear readability)
export const HUD_CUES = [
  { id: 'hud_crore',   text: '146 CRORE PEOPLE',  t0: 0.00, t1: 3.05 },
  { id: 'hud_china',   text: 'MORE THAN CHINA',   t0: 3.35, t1: 6.00 },
  { id: 'hud_05sqm',   text: '0.5 SQ M EACH',     t0: 6.35, t1: 9.95 },
  { id: 'hud_732',     text: '732 SQ KM',         t0: 10.25, t1: 12.80 },
  { id: 'hud_delhi',   text: 'DELHI: 1,483 SQ KM', t0: 12.85, t1: 15.50 },
  { id: 'hud_002pct',  text: '0.02% OF THE LAND', t0: 15.85, t1: 20.45 },
  { id: 'hud_56x',     text: '5.6x INDIA',        t0: 21.10, t1: 23.95 },
  { id: 'hud_4116',    text: '4,116 SQ KM',       t0: 24.30, t1: 27.35 },
  { id: 'hud_1118',    text: '1,118 KM AWAY',     t0: 27.70, t1: 31.75 },
  { id: 'hud_58full',  text: '58% FULL',          t0: 31.95, t1: 35.15 },
  // Seamless loop wrap-in for Frame 0 match
  { id: 'hud_crore_loop', text: '146 CRORE PEOPLE', t0: 37.15, t1: 37.50 }
];

// Deterministic sound & visual hit cues exported via window.EV -> events.json
export const EVENTS = [
  { t: 0.04,  type: 'sub_hit',    gain: 0.55 },
  { t: 2.65,  type: 'zoom_out',   dur: 0.65, gain: 0.70 },
  { t: 3.35,  type: 'shimmer',    gain: 0.45 },
  { t: 6.05,  type: 'dive_in',    dur: 0.45, gain: 0.75 },
  { t: 6.48,  type: 'neon_snap',  gain: 0.65 },
  { t: 8.05,  type: 'crane_rise', dur: 2.10, gain: 0.65 },
  { t: 10.25, type: 'tray_lock',  gain: 0.60 },
  { t: 12.55, type: 'pour_sand',  dur: 2.35, gain: 0.85 },
  { t: 14.90, type: 'fill_thump', gain: 0.70 },
  { t: 15.55, type: 'suckout',    dur: 0.55 },
  { t: 16.10, type: 'power_down', gain: 0.90 },
  { t: 17.75, type: 'city_ping',  pitch: 1.00, pan: -0.35, gain: 0.65 },
  { t: 18.31, type: 'city_ping',  pitch: 1.12, pan:  0.35, gain: 0.65 },
  { t: 18.93, type: 'city_ping',  pitch: 0.88, pan:  0.10, gain: 0.65 },
  { t: 20.65, type: 'arc_launch', dur: 2.80, gain: 0.75 },
  { t: 24.15, type: 'heavy_drop', gain: 0.85 },
  { t: 27.45, type: 'fly_east',   dur: 2.15, gain: 0.75 },
  { t: 31.65, type: 'suckout',    dur: 0.45 },
  { t: 31.10, type: 'pour_sand',  dur: 2.40, gain: 0.90 },
  { t: 32.15, type: 'fit_chime',  gain: 0.80 },
  { t: 34.45, type: 'whip_west',  dur: 2.75, gain: 0.80 }
];
