import { PerspectiveCamera } from 'three';
import { renderConfig } from './config';
import {
  clampPitch,
  damp,
  idleBlend,
  isClick,
  lerp,
  orbitDrag,
  orbitPan,
  orbitPosition,
  orbitZoom,
  type OrbitLimits,
  type OrbitState,
} from './math';

export interface IdleView {
  pitch: number;
  distance: number;
}

/**
 * Orbit state the camera should move towards. `blend` is 0 under manual
 * control and 1 in the idle sightseeing view, which circles slowly
 * (`idleYaw` is the angle travelled so far) at its own pitch and distance.
 */
export function orbitGoal(user: OrbitState, idleYaw: number, blend: number, idle: IdleView, limits: OrbitLimits): OrbitState {
  return {
    yaw: user.yaw + idleYaw,
    pitch: clampPitch(lerp(user.pitch, idle.pitch, blend), limits),
    distance: lerp(user.distance, idle.distance, blend),
  };
}

/**
 * Orbit camera around a point on the board. Right-button drag rotates and
 * tilts, middle-button drag moves that point, the wheel zooms towards it. Without input it drifts into a slow sightseeing
 * orbit and returns to the player's view on the next input.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  private readonly limits: OrbitLimits;
  private user: OrbitState;
  private drawn: OrbitState;
  private idleYaw = 0;
  private sinceInput = 0;
  private centre = { x: 0, z: 0 };
  private target: { x: number; y: number; z: number } = { x: 0, y: renderConfig.camera.targetHeight, z: 0 };
  /** The point the camera keeps to while something is being followed. */
  private following: { x: number; y: number; z: number } | null = null;
  /** The view before following began: where it looked and from how far. */
  private resume: { x: number; z: number; distance: number } | null = null;
  /** True while the camera is on its way back to that view. */
  private returning = false;
  private dragging = false;
  private panning = false;
  private lastX = 0;
  private lastY = 0;
  private pressX = 0;
  private pressY = 0;
  private pressed = false;
  private readonly unbind: Array<() => void> = [];

  constructor(
    private readonly element: HTMLElement,
    private readonly onClick: (clientX: number, clientY: number) => void,
    /** Called when a middle-button drag lets go of what was being followed, so the selection can go too. */
    private readonly onLetGo: () => void = () => {},
  ) {
    const c = renderConfig.camera;
    this.camera = new PerspectiveCamera(c.fovDeg, 1, c.near, c.far);
    this.limits = { minPitch: c.minPitch, maxPitch: c.maxPitch, minDistance: c.minDistance, maxDistance: c.maxDistance };
    this.user = { yaw: c.initialYaw, pitch: c.initialPitch, distance: c.initialDistance };
    this.drawn = { ...this.user };
    this.bind();
    this.apply();
  }

  /** Sets the board centre. The view keeps whatever offset the player has panned to. */
  setTarget(x: number, z: number): void {
    this.target.x += x - this.centre.x;
    this.target.z += z - this.centre.z;
    this.centre = { x, z };
  }

  /**
   * Keeps the camera on a moving point, zoomed in on it. Call every frame with
   * where the point is now; `null` lets go and returns to the view before.
   * Turning and zooming stay with the player meanwhile, moving the view does not.
   */
  follow(point: { x: number; y: number; z: number } | null): void {
    if (point) {
      if (!this.following) {
        if (!this.returning) this.resume = { x: this.target.x, z: this.target.z, distance: this.user.distance };
        this.wake();
        this.user = { ...this.user, distance: Math.min(this.user.distance, renderConfig.camera.follow.distance) };
      }
      this.following = point;
      this.returning = false;
    } else if (this.following) {
      this.following = null;
      this.returning = this.resume !== null;
      if (this.resume) this.user = { ...this.user, distance: this.resume.distance };
    }
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const c = renderConfig.camera;
    this.sinceInput += dt;
    if (this.following) {
      // Watching something is not being idle.
      this.sinceInput = 0;
      this.target.x = damp(this.target.x, this.following.x, c.follow.damping, dt);
      this.target.y = damp(this.target.y, c.targetHeight + this.following.y, c.follow.damping, dt);
      this.target.z = damp(this.target.z, this.following.z, c.follow.damping, dt);
    } else if (this.returning && this.resume) {
      this.target.x = damp(this.target.x, this.resume.x, c.follow.damping, dt);
      this.target.y = damp(this.target.y, c.targetHeight, c.follow.damping, dt);
      this.target.z = damp(this.target.z, this.resume.z, c.follow.damping, dt);
      if (Math.hypot(this.target.x - this.resume.x, this.target.z - this.resume.z) < 0.05) {
        this.target.y = c.targetHeight;
        this.returning = false;
      }
    }
    const blend = this.dragging || this.panning ? 0 : idleBlend(this.sinceInput, c.idle.delaySec, c.idle.rampSec);
    this.idleYaw += c.idle.yawSpeed * blend * dt;
    const goal = orbitGoal(this.user, this.idleYaw, blend, c.idle, this.limits);
    // Soft while sightseeing, snappy under manual control.
    const lambda = lerp(c.damping, c.idle.damping, blend);
    this.drawn = {
      yaw: damp(this.drawn.yaw, goal.yaw, Math.max(lambda, c.damping * 0.3), dt),
      pitch: damp(this.drawn.pitch, goal.pitch, lambda, dt),
      distance: damp(this.drawn.distance, goal.distance, lambda, dt),
    };
    this.apply();
  }

  private apply(): void {
    const p = orbitPosition(this.drawn, this.target);
    this.camera.position.set(p.x, p.y, p.z);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
    this.camera.updateMatrixWorld();
  }

  /** True once the camera has started drifting on its own because nothing was touched for a while. */
  get sightseeing(): boolean {
    return !this.dragging && !this.panning && this.sinceInput > renderConfig.camera.idle.delaySec;
  }

  /** The player did something: leave the sightseeing view but keep looking from where the camera is now. */
  private wake(): void {
    if (this.idleYaw !== 0) {
      this.user = { ...this.user, yaw: this.user.yaw + this.idleYaw };
      this.idleYaw = 0;
    }
    this.sinceInput = 0;
  }

  private bind(): void {
    const el = this.element;
    const c = renderConfig.camera;
    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, handler as EventListener, options);
      this.unbind.push(() => target.removeEventListener(type, handler as EventListener, options));
    };
    // Any mouse movement, also over the panels, counts as the player being there:
    // the sightseeing view only starts once the mouse has been still.
    listen(window, 'pointermove', () => this.wake());
    listen(window, 'pointerdown', () => this.wake());
    listen(el, 'contextmenu', (event) => event.preventDefault());
    listen(el, 'pointerdown', (event) => {
      this.wake();
      if (event.button === 1 || event.button === 2) {
        // Moving the view lets go of what it follows and stays where it is; moving it on the way back stops the return.
        if (event.button === 1) {
          if (this.following) {
            this.following = null;
            this.resume = null;
            this.returning = false;
            this.onLetGo();
          }
          this.panning = true;
          if (this.returning) {
            this.returning = false;
            this.target.y = c.targetHeight;
          }
        }
        else this.dragging = true;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        el.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      } else if (event.button === 0) {
        this.pressed = true;
        this.pressX = event.clientX;
        this.pressY = event.clientY;
      }
    });
    listen(el, 'pointermove', (event) => {
      if (!this.dragging && !this.panning) return;
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      if (this.dragging) this.user = orbitDrag(this.user, dx, dy, c.rotateSpeed, this.limits);
      if (this.panning) {
        const fov = (c.fovDeg * Math.PI) / 180;
        const unitsPerPixel = (2 * this.drawn.distance * Math.tan(fov / 2)) / Math.max(el.clientHeight, 1);
        const moved = orbitPan(this.target, this.drawn, dx, dy, unitsPerPixel, this.centre, c.panLimit);
        this.target.x = moved.x;
        this.target.z = moved.z;
      }
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.sinceInput = 0;
    });
    const release = (event: PointerEvent): void => {
      if (event.button === 2 && this.dragging) {
        this.dragging = false;
        el.releasePointerCapture?.(event.pointerId);
      } else if (event.button === 1 && this.panning) {
        this.panning = false;
        el.releasePointerCapture?.(event.pointerId);
      } else if (event.button === 0 && this.pressed) {
        this.pressed = false;
        if (isClick(this.pressX, this.pressY, event.clientX, event.clientY, renderConfig.click.maxTravelPx)) {
          this.onClick(event.clientX, event.clientY);
        }
      }
      this.sinceInput = 0;
    };
    listen(el, 'pointerup', release);
    listen(el, 'pointercancel', () => {
      this.dragging = false;
      this.panning = false;
      this.pressed = false;
    });
    // Stops the browser's own middle-click scrolling.
    listen(el, 'auxclick', (event) => event.preventDefault());
    listen(
      el,
      'wheel',
      (event) => {
        event.preventDefault();
        this.wake();
        const lines = event.deltaMode === 1 ? event.deltaY / 3 : event.deltaY / 100;
        this.user = orbitZoom(this.user, lines, c.zoomStep, this.limits);
      },
      { passive: false },
    );
  }

  dispose(): void {
    for (const off of this.unbind) off();
    this.unbind.length = 0;
  }
}
