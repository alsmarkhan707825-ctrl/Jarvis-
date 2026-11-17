import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { AssistantState, FlightTelemetry } from '../types/alsmar';

interface CockpitOrbSceneProps {
  state: AssistantState;
  inputLevel: number;
  outputLevel: number;
  audioBars: number[];
  onTelemetry?: (telemetry: FlightTelemetry) => void;
  onOrbClick?: () => void;
}

const WAYPOINT_LABELS = [
  'WPT-01 · ALPHA',
  'WPT-02 · ZENITH',
  'WPT-03 · EQUATOR',
  'WPT-04 · ORION',
  'WPT-05 · APEX',
  'WPT-06 · POLARIS',
];

// Reusable module-scope math objects to eliminate per-frame GC allocations
const _pos = new THREE.Vector3();
const _nextPos = new THREE.Vector3();
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();
const _targetQuat = new THREE.Quaternion();
const _bankQuat = new THREE.Quaternion();
const _dummyObj = new THREE.Object3D();
const _tmpColor = new THREE.Color();
const _crownTargetColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return true;
  }
}

function createEarthTexture(): { colorTex: THREE.CanvasTexture; emissiveTex: THREE.CanvasTexture } {
  const w = 1024;
  const h = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const cctx = colorCanvas.getContext('2d')!;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = w;
  emCanvas.height = h;
  const ectx = emCanvas.getContext('2d')!;

  // Deep royal-blue ocean gradient
  const bg = cctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#040B24');
  bg.addColorStop(0.5, '#0A1E54');
  bg.addColorStop(1, '#03081C');
  cctx.fillStyle = bg;
  cctx.fillRect(0, 0, w, h);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  // Subtle lat/lon navigation grid
  cctx.strokeStyle = 'rgba(96, 165, 250, 0.22)';
  cctx.lineWidth = 1;
  for (let gx = 0; gx <= w; gx += w / 16) {
    cctx.beginPath();
    cctx.moveTo(gx, 0);
    cctx.lineTo(gx, h);
    cctx.stroke();
  }
  for (let gy = 0; gy <= h; gy += h / 8) {
    cctx.beginPath();
    cctx.moveTo(0, gy);
    cctx.lineTo(w, gy);
    cctx.stroke();
  }

  // Procedural continental clusters in metallic gold + glowing navigation hubs
  for (let y = 20; y < h - 20; y += 8) {
    const lat = (y / h - 0.5) * Math.PI;
    for (let x = 0; x < w; x += 8) {
      const lon = (x / w) * Math.PI * 2;
      const n1 = Math.sin(lon * 2.2 + 0.5) * Math.cos(lat * 2.5 - 0.15);
      const n2 = Math.cos(lon * 3.8 - 1.2) * Math.sin(lat * 3.1 + 0.65);
      const n3 = Math.sin((lon + lat) * 5.2);
      const val = n1 * 0.54 + n2 * 0.34 + n3 * 0.16;

      if (val > 0.14) {
        const edge = val < 0.21;
        cctx.fillStyle = edge ? 'rgba(240, 201, 92, 0.92)' : 'rgba(212, 175, 55, 0.45)';
        cctx.beginPath();
        cctx.arc(x, y, edge ? 2.4 : 2.0, 0, Math.PI * 2);
        cctx.fill();

        if (edge && ((x + y) % 32 === 0)) {
          ectx.fillStyle = 'rgba(247, 223, 142, 0.9)';
          ectx.beginPath();
          ectx.arc(x, y, 2.2, 0, Math.PI * 2);
          ectx.fill();
        }
      }
    }
  }

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;

  const emissiveTex = new THREE.CanvasTexture(emCanvas);
  emissiveTex.colorSpace = THREE.SRGBColorSpace;
  emissiveTex.wrapS = THREE.RepeatWrapping;

  return { colorTex, emissiveTex };
}

function createRadarCompassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Outer concentric radar rings
  const rings = [470, 390, 300, 215];
  rings.forEach((radius, idx) => {
    ctx.strokeStyle = idx === 0 ? 'rgba(240, 201, 92, 0.55)' : 'rgba(59, 130, 246, 0.32)';
    ctx.lineWidth = idx === 0 ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Crosshair radial spokes every 30 degrees
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = (deg * Math.PI) / 180;
    ctx.strokeStyle = deg % 90 === 0 ? 'rgba(240, 201, 92, 0.32)' : 'rgba(96, 165, 250, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * 215, cy + Math.sin(rad) * 215);
    ctx.lineTo(cx + Math.cos(rad) * 470, cy + Math.sin(rad) * 470);
    ctx.stroke();
  }

  // Fine azimuth tick marks every 5 degrees
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180 - Math.PI / 2;
    const major = deg % 30 === 0;
    const med = deg % 15 === 0;
    const rOut = 470;
    const rIn = major ? 446 : med ? 454 : 461;
    ctx.strokeStyle = major ? 'rgba(247, 223, 142, 0.85)' : 'rgba(147, 197, 253, 0.45)';
    ctx.lineWidth = major ? 2.4 : 1.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * rIn, cy + Math.sin(rad) * rIn);
    ctx.lineTo(cx + Math.cos(rad) * rOut, cy + Math.sin(rad) * rOut);
    ctx.stroke();

    if (major) {
      const label =
        deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg).padStart(3, '0');
      ctx.save();
      ctx.translate(cx + Math.cos(rad) * 424, cy + Math.sin(rad) * 424);
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillStyle = deg % 90 === 0 ? '#F7DF8E' : 'rgba(191, 219, 254, 0.82)';
      ctx.font = '600 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRadarSweepTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const sweepSteps = 44;
  const maxArc = Math.PI * 0.42;
  for (let i = 0; i < sweepSteps; i += 1) {
    const t0 = (i / sweepSteps) * maxArc;
    const t1 = ((i + 1) / sweepSteps) * maxArc;
    const alpha = Math.pow(1 - i / sweepSteps, 1.7) * 0.45;
    ctx.fillStyle = `rgba(240, 201, 92, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size * 0.46, -t1, -t0);
    ctx.closePath();
    ctx.fill();
  }

  // Leading crisp radar beam edge
  ctx.strokeStyle = 'rgba(247, 223, 142, 0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + size * 0.46, cy);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 11-part composite 3D jet aircraft assembled cleanly along +Z forward nose axis
function buildAircraftModel(isSoftwareGl: boolean): {
  group: THREE.Group;
  afterburnerMat: THREE.MeshStandardMaterial;
  beaconLeft: THREE.MeshStandardMaterial;
  beaconRight: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x12327a,
    metalness: 0.88,
    roughness: 0.22,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x0b1c48,
    metalness: 0.84,
    roughness: 0.3,
  });
  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf0c95c,
    metalness: 0.95,
    roughness: 0.14,
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.52 : 0.92,
    ior: 1.5,
  });
  const afterburnerMat = new THREE.MeshStandardMaterial({
    color: 0xf7df8e,
    emissive: 0xd4af37,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.1,
  });

  // 1. Sleek Lathe Fuselage oriented along +Z
  const lathePts = [
    new THREE.Vector2(0.0, 0.42),
    new THREE.Vector2(0.032, 0.31),
    new THREE.Vector2(0.062, 0.14),
    new THREE.Vector2(0.072, -0.06),
    new THREE.Vector2(0.064, -0.26),
    new THREE.Vector2(0.044, -0.36),
    new THREE.Vector2(0.0, -0.36),
  ];
  const fuselageGeo = new THREE.LatheGeometry(lathePts, 20);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
  fuselage.castShadow = !isSoftwareGl;
  group.add(fuselage);

  // 2. Cockpit Glass Canopy
  const canopyGeo = new THREE.CapsuleGeometry(0.036, 0.14, 6, 12);
  canopyGeo.rotateX(Math.PI / 2);
  canopyGeo.scale(0.85, 0.65, 1.0);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.048, 0.14);
  group.add(canopy);

  // 3. Swept Main Delta Wings (ExtrudeGeometry with bevel)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.04, 0.1);
  wingShape.lineTo(0.42, -0.14);
  wingShape.lineTo(0.42, -0.22);
  wingShape.lineTo(0.05, -0.19);
  wingShape.closePath();

  const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  rightWingGeo.rotateX(Math.PI / 2);
  const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
  rightWing.position.set(0, 0.0, 0);
  rightWing.castShadow = !isSoftwareGl;
  group.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.x = -1;
  group.add(leftWing);

  // 4 & 5. Gold Wingtip Winglets
  const wingletGeo = new THREE.BoxGeometry(0.012, 0.065, 0.09);
  const wingletR = new THREE.Mesh(wingletGeo, goldTrimMat);
  wingletR.position.set(0.42, 0.025, -0.18);
  wingletR.rotation.z = -0.28;
  group.add(wingletR);

  const wingletL = new THREE.Mesh(wingletGeo, goldTrimMat);
  wingletL.position.set(-0.42, 0.025, -0.18);
  wingletL.rotation.z = 0.28;
  group.add(wingletL);

  // 6 & 7. Port/Starboard Navigation Strobe Lenses
  const beaconGeo = new THREE.SphereGeometry(0.013, 10, 10);
  const beaconLeft = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    emissive: 0x3b82f6,
    emissiveIntensity: 2.2,
  });
  const beaconRight = new THREE.MeshStandardMaterial({
    color: 0xf7df8e,
    emissive: 0xd4af37,
    emissiveIntensity: 2.2,
  });
  const strobeL = new THREE.Mesh(beaconGeo, beaconLeft);
  strobeL.position.set(-0.43, 0.048, -0.18);
  group.add(strobeL);

  const strobeR = new THREE.Mesh(beaconGeo, beaconRight);
  strobeR.position.set(0.43, 0.048, -0.18);
  group.add(strobeR);

  // 8 & 9. Twin Canted Vertical Stabilizers + Gold Trim Strip
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(-0.08, 0.14);
  finShape.lineTo(-0.15, 0.14);
  finShape.lineTo(-0.12, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.01,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
  });
  finGeo.rotateY(Math.PI / 2);

  const finR = new THREE.Mesh(finGeo, hullMat);
  finR.position.set(0.036, 0.028, -0.21);
  finR.rotation.z = -0.26;
  group.add(finR);

  const finL = new THREE.Mesh(finGeo, hullMat);
  finL.position.set(-0.046, 0.028, -0.21);
  finL.rotation.z = 0.26;
  group.add(finL);

  // Dorsal gold avionics spine
  const spineGeo = new THREE.BoxGeometry(0.018, 0.014, 0.34);
  const spine = new THREE.Mesh(spineGeo, goldTrimMat);
  spine.position.set(0, 0.068, -0.12);
  group.add(spine);

  // 10 & 11. Twin Turbofan Nacelles & Glowing Afterburners
  const nozzleGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.16, 14);
  nozzleGeo.rotateX(Math.PI / 2);
  const flameGeo = new THREE.ConeGeometry(0.02, 0.09, 12);
  flameGeo.rotateX(-Math.PI / 2);

  [-0.034, 0.034].forEach((offsetX) => {
    const nacelle = new THREE.Mesh(nozzleGeo, wingMat);
    nacelle.position.set(offsetX, -0.01, -0.31);
    group.add(nacelle);

    const flame = new THREE.Mesh(flameGeo, afterburnerMat);
    flame.position.set(offsetX, -0.01, -0.42);
    group.add(flame);
  });

  group.scale.setScalar(1.15);
  return { group, afterburnerMat, beaconLeft, beaconRight };
}

export function CockpitOrbScene({
  state,
  inputLevel,
  outputLevel,
  audioBars,
  onTelemetry,
  onOrbClick,
}: CockpitOrbSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const inputRef = useRef(inputLevel);
  inputRef.current = inputLevel;
  const outputRef = useRef(outputLevel);
  outputRef.current = outputLevel;
  const barsRef = useRef(audioBars);
  barsRef.current = audioBars;
  const telemetryCbRef = useRef(onTelemetry);
  telemetryCbRef.current = onTelemetry;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 480);

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030715, 0.036);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const aspect = (container.clientWidth || 640) / (container.clientHeight || 480);
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.set(0, 2.35, 6.4);

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;

    let userInteracting = false;
    const onControlStart = () => {
      userInteracting = true;
    };
    const onControlEnd = () => {
      userInteracting = false;
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    // Three-point Studio + Aviation Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x3b82f6, 0x050814, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xf7df8e, 2.1);
    keyLight.position.set(4.5, 5.5, 4.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -4;
      keyLight.shadow.camera.right = 4;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -4;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.45);
    rimLight.position.set(-4.5, 2.0, -5.0);
    scene.add(rimLight);

    // 1. CENTRAL JARVIS HOLOGRAPHIC ARC-REACTOR CORE
    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    const { colorTex, emissiveTex } = createEarthTexture();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    colorTex.anisotropy = maxAniso;
    emissiveTex.anisotropy = maxAniso;

    const globeGeo = new THREE.SphereGeometry(1.12, 48, 36);
    const globeMat = new THREE.MeshStandardMaterial({
      map: colorTex,
      emissive: new THREE.Color(0x38bdf8),
      emissiveMap: emissiveTex,
      emissiveIntensity: 0.9,
      metalness: 0.55,
      roughness: 0.25,
    });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeMesh.rotation.z = THREE.MathUtils.degToRad(18);
    globeMesh.receiveShadow = !isSoftwareGl;
    orbGroup.add(globeMesh);

    // Volumetric JARVIS Plasma Lattice & Inner Energy Shell
    const plasmaGeo = new THREE.SphereGeometry(1.16, 40, 32);
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAudio: { value: 0 },
        uPrimary: { value: new THREE.Color(0x38bdf8) },
        uAccent: { value: new THREE.Color(0xf0c95c) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        varying vec3 vViewDir;
        void main() {
          vPos = position;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uAudio;
        uniform vec3 uPrimary;
        uniform vec3 uAccent;
        varying vec3 vNormal;
        varying vec3 vPos;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.1);
          float bandA = sin(vPos.y * 11.0 - uTime * 3.4 + vPos.x * 4.5);
          float bandB = cos(vPos.z * 9.0 + uTime * 2.6 - vPos.y * 5.0);
          float wave = smoothstep(0.15, 0.95, (bandA * bandB) * 0.5 + 0.5);
          vec3 col = mix(uPrimary, uAccent, wave * (0.42 + uAudio * 0.45));
          float alpha = fresnel * (0.38 + uAudio * 0.45) + wave * 0.14;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const plasmaShell = new THREE.Mesh(plasmaGeo, plasmaMat);
    orbGroup.add(plasmaShell);

    const wireGeo = new THREE.IcosahedronGeometry(1.23, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    orbGroup.add(wireMesh);

    // Outer Fresnel Atmospheric Corona
    const rimGeo = new THREE.SphereGeometry(1.36, 36, 28);
    const rimMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x38bdf8) },
        uIntensity: { value: 0.85 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.5);
          gl_FragColor = vec4(uColor, fresnel * uIntensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const rimShell = new THREE.Mesh(rimGeo, rimMat);
    orbGroup.add(rimShell);

    // JARVIS Precision Gimbal Rings & Segmented Arc-Reactor HUD Rings
    const goldRingMat = new THREE.MeshStandardMaterial({
      color: 0xf0c95c,
      metalness: 0.95,
      roughness: 0.14,
      emissive: 0xd4af37,
      emissiveIntensity: 0.45,
    });
    const cyanRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.55,
    });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.016, 12, 96), goldRingMat);
    ring1.rotation.set(Math.PI * 0.36, 0.25, 0);
    orbGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.012, 10, 96), cyanRingMat);
    ring2.rotation.set(-Math.PI * 0.32, -0.4, 0.2);
    orbGroup.add(ring2);

    // Segmented JARVIS Holo Arcs (4 opposing reticle quadrants)
    const arcGroup = new THREE.Group();
    const arcGeo = new THREE.TorusGeometry(1.82, 0.014, 8, 40, Math.PI * 0.34);
    for (let a = 0; a < 4; a += 1) {
      const seg = new THREE.Mesh(arcGeo, a % 2 === 0 ? cyanRingMat : goldRingMat);
      seg.rotation.z = (a * Math.PI) / 2;
      arcGroup.add(seg);
    }
    arcGroup.rotation.x = Math.PI * 0.16;
    orbGroup.add(arcGroup);

    // 48-Fin JARVIS Arc-Reactor Turbine & Audio-Reactive Radial Crown
    const BAR_COUNT = 48;
    const barGeo = new THREE.BoxGeometry(0.026, 0.18, 0.045);
    const barMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.05,
      metalness: 0.72,
      roughness: 0.18,
    });
    const audioCrown = new THREE.InstancedMesh(barGeo, barMat, BAR_COUNT);
    audioCrown.frustumCulled = false;
    orbGroup.add(audioCrown);

    // 2. AVIATION RADAR COMPASS PLANE & SWEEP
    const radarGroup = new THREE.Group();
    radarGroup.position.y = -0.18;
    scene.add(radarGroup);

    const compassTex = createRadarCompassTexture(maxAniso);
    const compassGeo = new THREE.PlaneGeometry(5.8, 5.8);
    compassGeo.rotateX(-Math.PI / 2);
    const compassMat = new THREE.MeshBasicMaterial({
      map: compassTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const compassMesh = new THREE.Mesh(compassGeo, compassMat);
    radarGroup.add(compassMesh);

    const sweepTex = createRadarSweepTexture();
    const sweepGeo = new THREE.PlaneGeometry(5.6, 5.6);
    sweepGeo.rotateX(-Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      map: sweepTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
    sweepMesh.position.y = 0.015;
    radarGroup.add(sweepMesh);

    // 3. ANIMATED FLIGHT PATHS & GLOWING WAYPOINTS
    const flightPts: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i += 1) {
      const t = (i / 48) * Math.PI * 2;
      const rad = 2.28 + Math.sin(t * 2) * 0.16;
      const y = Math.sin(t + 0.4) * 0.44 + 0.12;
      flightPts.push(new THREE.Vector3(Math.cos(t) * rad, y, Math.sin(t) * rad));
    }
    const flightCurve = new THREE.CatmullRomCurve3(flightPts, true);
    const pathGeo = new THREE.TubeGeometry(flightCurve, 140, 0.011, 8, true);
    const pathMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.52,
    });
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    scene.add(pathMesh);

    const secondaryPts: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i += 1) {
      const t = (i / 48) * Math.PI * 2;
      const rad = 2.52;
      const y = -Math.cos(t * 2 - 0.5) * 0.36;
      secondaryPts.push(new THREE.Vector3(Math.cos(t) * rad, y, Math.sin(t) * rad));
    }
    const secondaryCurve = new THREE.CatmullRomCurve3(secondaryPts, true);
    const secPathGeo = new THREE.TubeGeometry(secondaryCurve, 120, 0.007, 6, true);
    const secPathMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      transparent: true,
      opacity: 0.34,
    });
    scene.add(new THREE.Mesh(secPathGeo, secPathMat));

    // Glowing Waypoints along the main flight corridor
    const waypointNodes: Array<{ group: THREE.Group; mat: THREE.MeshStandardMaterial }> = [];
    const wpCoreGeo = new THREE.OctahedronGeometry(0.055, 0);
    const wpHaloGeo = new THREE.RingGeometry(0.085, 0.11, 24);
    wpHaloGeo.rotateX(-Math.PI / 2);

    for (let w = 0; w < 6; w += 1) {
      const t = w / 6;
      const pos = flightCurve.getPointAt(t);
      const wpGroup = new THREE.Group();
      wpGroup.position.copy(pos);
      const wpMat = new THREE.MeshStandardMaterial({
        color: 0xf7df8e,
        emissive: 0xd4af37,
        emissiveIntensity: 1.4,
        metalness: 0.6,
        roughness: 0.2,
      });
      const core = new THREE.Mesh(wpCoreGeo, wpMat);
      const halo = new THREE.Mesh(
        wpHaloGeo,
        new THREE.MeshBasicMaterial({ color: 0xf0c95c, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
      );
      wpGroup.add(core);
      wpGroup.add(halo);
      scene.add(wpGroup);
      waypointNodes.push({ group: wpGroup, mat: wpMat });
    }

    // 4. COMPOSITE 3D EXECUTIVE JET AIRCRAFT
    const aircraft = buildAircraftModel(isSoftwareGl);
    scene.add(aircraft.group);

    // 5. DYNAMIC ATMOSPHERIC PARTICLES (Instanced Starfield / Orbital Motes)
    const PARTICLE_COUNT = 160;
    const moteGeo = new THREE.SphereGeometry(0.018, 6, 6);
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.65,
    });
    const motes = new THREE.InstancedMesh(moteGeo, moteMat, PARTICLE_COUNT);
    const moteOffsets = Array.from({ length: PARTICLE_COUNT }, (_, idx) => ({
      radius: 2.0 + ((idx * 17) % 45) * 0.11,
      angle: (idx / PARTICLE_COUNT) * Math.PI * 2,
      y: (((idx * 29) % 100) / 100 - 0.5) * 4.2,
      speed: 0.04 + (idx % 7) * 0.012,
      scale: 0.6 + (idx % 4) * 0.3,
    }));
    moteOffsets.forEach((m, idx) => {
      _dummyObj.position.set(Math.cos(m.angle) * m.radius, m.y, Math.sin(m.angle) * m.radius);
      _dummyObj.scale.setScalar(m.scale);
      _dummyObj.updateMatrix();
      motes.setMatrixAt(idx, _dummyObj.matrix);
    });
    motes.computeBoundingSphere();
    scene.add(motes);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let flightProgress = 0;
    let smoothAmp = 0;
    let smoothSpin = 0.25;
    let smoothRadarSpeed = 0.7;
    let smoothFlightSpeed = 0.055;
    let lastTelemetryPush = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

      const rawAmp =
        st === 'LISTENING'
          ? inputRef.current
          : st === 'SPEAKING'
            ? outputRef.current
            : st === 'EXECUTING'
              ? 0.48
              : st === 'THINKING' || st === 'PROCESSING'
                ? 0.36
                : st === 'WAITING'
                  ? 0.14
                  : 0.04;

      const targetSpin =
        st === 'THINKING' || st === 'PROCESSING'
          ? 1.05
          : st === 'EXECUTING'
            ? 1.15
            : st === 'SPEAKING'
              ? 0.58
              : st === 'LISTENING'
                ? 0.44
                : 0.22;

      const targetRadar =
        st === 'EXECUTING'
          ? 2.6
          : st === 'THINKING' || st === 'PROCESSING'
            ? 2.0
            : st === 'LISTENING'
              ? 1.2
              : 0.65;

      const targetFlight =
        st === 'EXECUTING'
          ? 0.14
          : st === 'THINKING' || st === 'PROCESSING'
            ? 0.105
            : st === 'SPEAKING'
              ? 0.075
              : 0.048;

      smoothAmp = THREE.MathUtils.damp(smoothAmp, rawAmp, 12, dt);
      smoothSpin = THREE.MathUtils.damp(smoothSpin, targetSpin, 5, dt);
      smoothRadarSpeed = THREE.MathUtils.damp(smoothRadarSpeed, targetRadar, 5, dt);
      smoothFlightSpeed = THREE.MathUtils.damp(smoothFlightSpeed, targetFlight, 5, dt);

      // Update JARVIS Holographic Core, Plasma Shader & Gyro Rings
      globeMesh.rotation.y += smoothSpin * dt;
      wireMesh.rotation.y -= smoothSpin * 0.52 * dt;
      wireMesh.rotation.x += smoothSpin * 0.18 * dt;
      const orbScale = 1 + smoothAmp * 0.095;
      orbGroup.scale.setScalar(orbScale);

      ring1.rotation.z += smoothSpin * 0.78 * dt;
      ring2.rotation.z -= smoothSpin * 0.62 * dt;
      arcGroup.rotation.z += smoothSpin * 0.95 * dt;
      arcGroup.rotation.y = Math.sin(elapsed * 0.45) * 0.22;

      plasmaMat.uniforms.uTime.value = elapsed;
      plasmaMat.uniforms.uAudio.value = smoothAmp;

      // State-aware Fresnel Rim & Arc-Reactor Crown Lighting
      const isErr = st === 'ERROR' || st === 'OFFLINE';
      const targetColor = isErr
        ? 0xef4444
        : st === 'SPEAKING' || st === 'EXECUTING'
          ? 0xf0c95c
          : st === 'THINKING' || st === 'PROCESSING'
            ? 0xa855f7
            : st === 'LISTENING'
              ? 0x38bdf8
              : st === 'WAITING'
                ? 0x60a5fa
                : 0x0ea5e9;
      _tmpColor.setHex(targetColor);
      rimMat.uniforms.uColor.value.lerp(_tmpColor, 0.12);
      plasmaMat.uniforms.uPrimary.value.lerp(_tmpColor, 0.12);
      wireMat.color.lerp(_tmpColor, 0.1);
      rimMat.uniforms.uIntensity.value = THREE.MathUtils.damp(
        rimMat.uniforms.uIntensity.value,
        st === 'SPEAKING' || st === 'LISTENING' || st === 'THINKING' || st === 'PROCESSING' || st === 'EXECUTING'
          ? 1.32
          : 0.78,
        6,
        dt
      );

      // Update 48-Fin Arc-Reactor Audio Turbine Crown
      _crownTargetColor.setHex(
        isErr
          ? 0xf87171
          : st === 'THINKING' || st === 'PROCESSING'
            ? 0xc084fc
            : st === 'LISTENING'
              ? 0x38bdf8
              : 0xf7df8e
      );
      barMat.color.lerp(_crownTargetColor, 0.14);
      barMat.emissive.lerp(_crownTargetColor, 0.14);

      const bars = barsRef.current;
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const angle = (i / BAR_COUNT) * Math.PI * 2;
        const barVal =
          st === 'LISTENING' || st === 'SPEAKING'
            ? bars[i % (bars.length || 1)] ?? smoothAmp
            : st === 'THINKING' || st === 'PROCESSING' || st === 'EXECUTING'
              ? 0.28 + Math.sin(elapsed * 7.5 + i * 0.45) * 0.24
              : st === 'WAITING'
                ? 0.16 + Math.sin(elapsed * 3.5 + i * 0.35) * 0.08
                : 0.09 + Math.sin(elapsed * 2.2 + i * 0.3) * 0.04;
        const rCrown = 1.44 + barVal * 0.1;
        _dummyObj.position.set(Math.cos(angle) * rCrown, Math.sin(elapsed * 2 + i * 0.25) * 0.015, Math.sin(angle) * rCrown);
        _dummyObj.rotation.set(0, -angle, Math.PI * 0.5);
        _dummyObj.scale.set(1, 0.4 + barVal * 3.3, 1);
        _dummyObj.updateMatrix();
        audioCrown.setMatrixAt(i, _dummyObj.matrix);
      }
      audioCrown.instanceMatrix.needsUpdate = true;
      barMat.emissiveIntensity = 0.85 + smoothAmp * 1.65;

      // Rotate Aviation Radar Sweep
      sweepMesh.rotation.y -= smoothRadarSpeed * dt;
      compassMesh.rotation.y += 0.035 * dt;

      // Advance 3D Aircraft Along Banked Great-Circle Flight Path
      flightProgress = (flightProgress + smoothFlightSpeed * dt) % 1;
      const lookAhead = (flightProgress + 0.01) % 1;
      flightCurve.getPointAt(flightProgress, _pos);
      flightCurve.getPointAt(lookAhead, _nextPos);

      _forward.subVectors(_nextPos, _pos).normalize();
      _up.copy(_pos).normalize();
      _right.crossVectors(_up, _forward).normalize();
      _up.crossVectors(_forward, _right).normalize();
      _rotMat.makeBasis(_right, _up, _forward);
      _targetQuat.setFromRotationMatrix(_rotMat);

      // Bank aircraft smoothly inward toward globe center
      _bankQuat.setFromAxisAngle(_forward, -0.34 - Math.sin(elapsed * 1.4) * 0.08);
      aircraft.group.position.copy(_pos);
      aircraft.group.quaternion.copy(_targetQuat).premultiply(_bankQuat);

      // Aircraft Engine Afterburner & Nav Beacons
      aircraft.afterburnerMat.emissiveIntensity =
        st === 'EXECUTING' ? 3.2 : st === 'THINKING' ? 2.6 : 1.5 + Math.sin(elapsed * 12) * 0.25;
      const strobePulse = Math.sin(elapsed * 7) > 0.65 ? 3.0 : 0.7;
      aircraft.beaconLeft.emissiveIntensity = strobePulse;
      aircraft.beaconRight.emissiveIntensity = strobePulse;

      // Animate Waypoint Beacons
      waypointNodes.forEach((wp, idx) => {
        wp.group.rotation.y += dt * 1.1;
        const activeWp = Math.floor(flightProgress * 6) % 6 === idx;
        wp.mat.emissiveIntensity = activeWp || st === 'EXECUTING' ? 2.4 : 1.0 + Math.sin(elapsed * 2.5 + idx) * 0.35;
      });

      // Gentle Orbital Particle Drift
      motes.rotation.y += dt * 0.04;

      // Smooth Camera Framing When User Not Dragging
      if (!userInteracting) {
        const targetCamY = st === 'EXECUTING' ? 2.8 : st === 'THINKING' ? 2.15 : 2.35;
        const targetCamZ = st === 'EXECUTING' ? 6.95 : st === 'THINKING' ? 5.95 : 6.4;
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 3.2, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 3.2, dt);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, Math.sin(elapsed * 0.25) * 0.35, 2.5, dt);
        camera.lookAt(0, 0, 0);
      }
      controls.update();

      // Throttled Telemetry Sync (~10 Hz) for Cockpit HUD Altitude / Speed / Heading
      if (telemetryCbRef.current && elapsed - lastTelemetryPush > 0.1) {
        lastTelemetryPush = elapsed;
        const headingRaw = ((Math.atan2(_forward.x, _forward.z) * 180) / Math.PI + 360) % 360;
        const wpIdx = Math.floor(flightProgress * WAYPOINT_LABELS.length) % WAYPOINT_LABELS.length;
        telemetryCbRef.current({
          altitudeFt: Math.round(34200 + _pos.y * 1400 + smoothAmp * 280),
          airspeedKts: Math.round(460 + smoothFlightSpeed * 1850),
          headingDeg: Math.round(headingRaw),
          waypointLabel: WAYPOINT_LABELS[wpIdx],
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
      colorTex.dispose();
      emissiveTex.dispose();
      compassTex.dispose();
      sweepTex.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglUnavailable) {
    return (
      <div
        onClick={onOrbClick}
        className="w-full h-full flex items-center justify-center cursor-pointer"
      >
        <div className="w-56 h-56 rounded-full border-2 border-[#D4AF37]/60 bg-gradient-to-br from-[#17368F] via-[#0B173D] to-[#030714] shadow-[0_0_60px_rgba(37,99,235,0.4)] flex items-center justify-center">
          <span className="font-display tracking-[0.28em] text-[#F0C95C] text-lg font-semibold">
            AL-SMAR
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={onOrbClick}
      aria-label="AL-SMAR 3D Aviation Navigation & AI Orb Viewport"
      className="w-full h-full cursor-pointer"
    />
  );
}
