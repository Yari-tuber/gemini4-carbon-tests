import { BLOCK_DEFS, DEFAULT_HOTBAR, PLACEABLE_BLOCKS } from '../world/BlockRegistry.js';

export class HUDManager {
  constructor(atlas, onSelectBlock, onInventoryToggle) {
    this.atlas = atlas;
    this.onSelectBlock = onSelectBlock;
    this.onInventoryToggle = onInventoryToggle;

    this.hotbar = [...DEFAULT_HOTBAR];
    this.selectedIndex = 0;
    this.inventoryOpen = false;

    this.elHotbar = document.getElementById('hotbar');
    this.elBlockLabel = document.getElementById('block-label');
    this.elModeBadge = document.getElementById('mode-badge');
    this.elAltitude = document.getElementById('altitude-readout');
    this.elIntroCard = document.getElementById('intro-overlay');
    this.elCrosshair = document.getElementById('crosshair');
    this.elInventory = document.getElementById('inventory-modal');
    this.elInventoryGrid = document.getElementById('inventory-grid');
    this.elControlsHint = document.getElementById('controls-hint');

    this._labelTimer = null;

    this._renderHotbar();
    this._renderInventoryPalette();
    this._bindHotbarEvents();
    this.updateModeBadge('GLIDING');
  }

  get currentBlockId() {
    return this.hotbar[this.selectedIndex];
  }

  _renderHotbar() {
    this.elHotbar.innerHTML = '';
    this.hotbar.forEach((blockId, idx) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (idx === this.selectedIndex ? ' active' : '');
      slot.dataset.index = idx;

      const keyNum = document.createElement('span');
      keyNum.className = 'slot-num';
      keyNum.textContent = String(idx + 1);

      const img = document.createElement('img');
      img.src = this.atlas.getIconUrl(blockId);
      img.alt = BLOCK_DEFS[blockId]?.name || '';

      slot.appendChild(keyNum);
      slot.appendChild(img);
      slot.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.selectSlot(idx);
      });
      this.elHotbar.appendChild(slot);
    });
  }

  _renderInventoryPalette() {
    this.elInventoryGrid.innerHTML = '';
    for (const blockId of PLACEABLE_BLOCKS) {
      const def = BLOCK_DEFS[blockId];
      const item = document.createElement('button');
      item.className = 'inv-item';
      item.type = 'button';

      const img = document.createElement('img');
      img.src = this.atlas.getIconUrl(blockId);
      img.alt = def.name;

      const name = document.createElement('span');
      name.textContent = def.name;

      item.appendChild(img);
      item.appendChild(name);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hotbar[this.selectedIndex] = blockId;
        this._renderHotbar();
        this._flashBlockName();
        if (this.onSelectBlock) this.onSelectBlock(blockId);
        this.setInventoryOpen(false, true);
      });

      this.elInventoryGrid.appendChild(item);
    }
  }

  _bindHotbarEvents() {
    window.addEventListener('wheel', (e) => {
      if (this.inventoryOpen) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = (this.selectedIndex + dir + 9) % 9;
      this.selectSlot(next);
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) {
          this.selectSlot(n - 1);
        }
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        this.setInventoryOpen(!this.inventoryOpen, true);
      } else if (e.code === 'Escape' && this.inventoryOpen) {
        this.setInventoryOpen(false, false);
      }
    });
  }

  selectSlot(idx) {
    this.selectedIndex = idx;
    const slots = this.elHotbar.querySelectorAll('.hotbar-slot');
    slots.forEach((s, i) => s.classList.toggle('active', i === idx));
    this._flashBlockName();
    if (this.onSelectBlock) this.onSelectBlock(this.currentBlockId);
  }

  pickBlockToHotbar(blockId) {
    if (!PLACEABLE_BLOCKS.includes(blockId)) return;
    const existing = this.hotbar.indexOf(blockId);
    if (existing !== -1) {
      this.selectSlot(existing);
    } else {
      this.hotbar[this.selectedIndex] = blockId;
      this._renderHotbar();
      this._flashBlockName();
      if (this.onSelectBlock) this.onSelectBlock(blockId);
    }
  }

  _flashBlockName() {
    const def = BLOCK_DEFS[this.currentBlockId];
    if (!def || !this.elBlockLabel) return;
    this.elBlockLabel.textContent = def.name;
    this.elBlockLabel.classList.add('show');
    if (this._labelTimer) clearTimeout(this._labelTimer);
    this._labelTimer = setTimeout(() => {
      this.elBlockLabel.classList.remove('show');
    }, 1800);
  }

  setInventoryOpen(open, requestLockOnClose = false) {
    this.inventoryOpen = open;
    this.elInventory.classList.toggle('open', open);
    if (open) {
      document.exitPointerLock?.();
    } else if (requestLockOnClose) {
      const canvas = document.querySelector('canvas');
      canvas?.requestPointerLock?.();
    }
    if (this.onInventoryToggle) this.onInventoryToggle(open);
  }

  updateModeBadge(mode) {
    if (!this.elModeBadge) return;
    if (mode === 'GLIDING') {
      this.elModeBadge.innerHTML = `<span class="badge-dot glide"></span>高空滑翔中 · <kbd>空格</kbd>上升 <kbd>Shift</kbd>俯冲 · 落地切步行`;
    } else {
      this.elModeBadge.innerHTML = `<span class="badge-dot walk"></span>步行模式 · 双击<kbd>空格</kbd> 或按 <kbd>F</kbd> 随时起飞`;
    }
  }

  updateFrameState(player, seaLevel) {
    const locked = player.isLocked;
    this.elIntroCard.classList.toggle('hidden', locked || this.inventoryOpen);
    this.elCrosshair.classList.toggle('visible', locked && !this.inventoryOpen);
    this.elControlsHint.classList.toggle('visible', locked && !this.inventoryOpen);

    if (this.elAltitude) {
      const alt = Math.round(player.pos.y - seaLevel);
      this.elAltitude.textContent = `海拔 ${alt >= 0 ? '+' + alt : alt}m`;
    }
  }
}
