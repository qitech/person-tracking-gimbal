import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { FrameSnapshot } from '../app/state';

const DEG = Math.PI / 180;
const CONE_LENGTH = 2.6;

/** Pan/tilt platform: base, yaw fork (pan), camera head (tilt) and a FOV cone. */
export class Gimbal3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  private controls: OrbitControls;
  private yaw = new THREE.Group();
  private pitch = new THREE.Group();
  private cone: THREE.Mesh;
  private coneHfov = 0;
  private observer: ResizeObserver;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.camera.position.set(2.4, 2.0, 3.6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.7, -0.6);
    this.controls.enableDamping = true;
    this.controls.update();

    this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x1a2230, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(3, 5, 4);
    this.scene.add(sun);
    const grid = new THREE.GridHelper(8, 16, 0x2a3542, 0x1b2430);
    this.scene.add(grid);

    const metal = new THREE.MeshStandardMaterial({ color: 0x4a5868, metalness: 0.6, roughness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x20262e, metalness: 0.3, roughness: 0.6 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x35d0ff, emissive: 0x0b3a4a, roughness: 0.4 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.18, 48), dark);
    base.position.y = 0.09;
    this.scene.add(base);

    // Yaw (pan) stage with a U-shaped fork.
    this.yaw.position.y = 0.18;
    this.scene.add(this.yaw);
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 48), metal);
    turntable.position.y = 0.04;
    this.yaw.add(turntable);
    for (const x of [-0.36, 0.36]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.7, 0.16), metal);
      arm.position.set(x, 0.43, 0);
      this.yaw.add(arm);
    }

    // Pitch (tilt) head: camera body facing -Z.
    this.pitch.position.y = 0.7;
    this.yaw.add(this.pitch);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.4), dark);
    this.pitch.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.18, 32), accent);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.29;
    this.pitch.add(lens);

    this.cone = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.cone.position.z = -0.38;
    this.pitch.add(this.cone);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  render(s: FrameSnapshot): void {
    if (s.virtHfovDeg !== this.coneHfov) this.rebuildCone(s.virtHfovDeg);
    // Pan right (+) turns the head right when viewed from behind; tilt up (+) raises it.
    this.yaw.rotation.y = -s.gimbal.pan * DEG;
    this.pitch.rotation.x = s.gimbal.tilt * DEG;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.observer.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }

  private rebuildCone(hfovDeg: number): void {
    this.coneHfov = hfovDeg;
    const radius = CONE_LENGTH * Math.tan((hfovDeg * DEG) / 2) * Math.SQRT2; // corner radius of a square pyramid
    const g = new THREE.ConeGeometry(radius, CONE_LENGTH, 4, 1, true, Math.PI / 4);
    g.translate(0, -CONE_LENGTH / 2, 0); // apex at origin
    g.rotateX(Math.PI / 2); // open towards -Z
    g.scale(1, 9 / 16, 1); // match the frame aspect
    this.cone.geometry.dispose();
    this.cone.geometry = g;
  }
}
