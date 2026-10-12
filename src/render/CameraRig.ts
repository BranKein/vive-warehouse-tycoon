import { PerspectiveCamera } from 'three';
import { renderConfig } from './config';
import {
  clampPitch,
  damp,
  idleBlend,
  lerp,
  orbitDrag,
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
 * Orbit camera around the centre of the board. Right-button drag rotates and
 * tilts, the wheel zooms. Without input it drifts into a slow sightseeing
 * orbit and returns to the player's view on the next input.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  private readonly limits: OrbitLimits;
  private user: OrbitState;
  private drawn: OrbitState;
  private idleYaw = 0;
  private sinceInput = 0;
  private target = { x: 0, y: renderConfig.camera.targetHeight, z: 0 };
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pressX = 0;
  private pressY = 0;
  private pressed = false;
  private readonly unbind: Array<() => void> = [];

  constructor(
    private readonly element: HTMLElement,
    private readonly onClick: (clientX: number, clientY: number) => void,
  ) {
    const c = renderConfig.camera;
    this.camera = new PerspectiveCamera(c.fovDeg, 1, c.near, c.far);
    this.limits = { minPitch: c.minPitch, maxPitch: c.maxPitch, minDistance: c.minDistance, maxDistance: c.maxDistance };
    this.user = { yaw: c.initialYaw, pitch: c.initialPitch, distance: c.initialDistance };
    this.drawn = { ...this.user };
    this.bind();
    this.apply();
  }

  setTarget(x: number, z: number): void {
    this.target = { x, y: renderConfig.camera.targetHeight, z };
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const c = renderConfig.camera;
    this.sinceInput += dt;
    const blend = this.dragging ? 0 : idleBlend(this.sinceInput, c.idle.delaySec, c.idle.rampSec);
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
    listen(el, 'contextmenu', (event) => event.preventDefault());
    listen(el, 'pointerdown', (event) => {
      this.wake();
      if (event.button === 2) {
        this.dragging = true;
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
      if (!this.dragging) return;
      this.user = orbitDrag(this.user, event.clientX - this.lastX, event.clientY - this.lastY, c.rotateSpeed, this.limits);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.sinceInput = 0;
    });
    const release = (event: PointerEvent): void => {
      if (event.button === 2 && this.dragging) {
        this.dragging = false;
        el.releasePointerCapture?.(event.pointerId);
      } else if (event.button === 0 && this.pressed) {
        this.pressed = false;
        const travel = Math.hypot(event.clientX - this.pressX, event.clientY - this.pressY);
        if (travel <= renderConfig.click.maxTravelPx) this.onClick(event.clientX, event.clientY);
      }
      this.sinceInput = 0;
    };
    listen(el, 'pointerup', release);
    listen(el, 'pointercancel', () => {
      this.dragging = false;
      this.pressed = false;
    });
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
