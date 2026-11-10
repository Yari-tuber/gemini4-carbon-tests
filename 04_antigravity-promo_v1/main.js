import { DUR } from './timeline.js';
import { renderFrame, renderPoster, buildEvents, visibleTexts } from './film.js';

const canvas = document.getElementById('c');
const g = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const scene = params.get('scene') || '';
const noSub = params.get('nosub') === '1';

window.DUR = DUR;
window.EV = buildEvents();
window.TEXTS = (t) => (scene === 'poster' ? [] : visibleTexts(t));
window.render = (t) => {
  if (scene === 'poster') {
    renderPoster(g);
  } else {
    renderFrame(g, t, { noSub });
  }
};

// Explicitly load all required self-hosted font weights before setting window.READY = true
Promise.all([
  document.fonts.load('400 24px Inter'),
  document.fonts.load('500 24px Inter'),
  document.fonts.load('600 24px Inter'),
  document.fonts.load('600 120px InterTight'),
  document.fonts.load('500 18px JBMono'),
  document.fonts.load('400 32px NotoSC'),
  document.fonts.load('500 38px NotoSC'),
  document.fonts.load('700 96px NotoSC'),
]).then(() => document.fonts.ready).then(() => {
  window.render(0);
  window.READY = true;
});
