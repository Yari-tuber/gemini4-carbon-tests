export class InputManager {
  public keysDown = new Set<string>();
  public keysJustPressed = new Set<string>();
  public mouseLeft = false;
  public mouseLeftJust = false;
  public mouseRight = false;
  public mouseDX = 0;
  public mouseDY = 0;
  public wheelDelta = 0;
  public isPointerLocked = false;
  public uiBlockingPointer = false;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (!this.keysDown.has(code)) {
        this.keysJustPressed.add(code);
      }
      this.keysDown.add(code);

      if (
        ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code) &&
        !this.uiBlockingPointer
      ) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.mouseLeft = false;
      this.mouseRight = false;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.uiBlockingPointer) return;
      if (!this.isPointerLocked) {
        this.requestLock();
      }
      if (e.button === 0) {
        this.mouseLeft = true;
        this.mouseLeftJust = true;
      } else if (e.button === 2) {
        this.mouseRight = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) this.mouseRight = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && !this.uiBlockingPointer) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.uiBlockingPointer) {
          this.wheelDelta += Math.sign(e.deltaY);
        }
      },
      { passive: true }
    );

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  public requestLock(): void {
    if (this.uiBlockingPointer) return;
    try {
      this.canvas.requestPointerLock();
    } catch {
      // Ignore browser lock gesture timing errors
    }
  }

  public releaseLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  public isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  public justPressed(code: string): boolean {
    return this.keysJustPressed.has(code);
  }

  public endFrame(): void {
    this.keysJustPressed.clear();
    this.mouseLeftJust = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
  }
}
