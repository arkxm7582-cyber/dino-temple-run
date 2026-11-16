import * as THREE from 'three';
import { LANE_WIDTH, LEVELS, laneToX, getDino } from '../game/config.js';

const TILE_LENGTH = 10;
const TILE_COUNT = 20;
const SCENERY_SPACING = 7;
const SCENERY_COUNT = 30;
const PARTICLE_COUNT = 250;
const TRACK_WIDTH = LANE_WIDTH * 3 + 1;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    this.webgl = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.05;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#ffffff', 45, 175);

    // camera: behind and above the dino
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    this.camera.position.set(0, 4.3, 7.5);

    this.shapes = {
      box: new THREE.BoxGeometry(1, 1, 1),
      ball: new THREE.SphereGeometry(0.5, 24, 16),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
      cone: new THREE.ConeGeometry(0.5, 1, 16),
      rock: new THREE.DodecahedronGeometry(0.5, 1),
      coin: new THREE.CylinderGeometry(0.42, 0.42, 0.1, 28),
    };

    this.materials = {
      ground: new THREE.MeshStandardMaterial({ map: makeDirtTexture(), roughness: 0.95 }),
      grass: new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 }),
      stone: new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }),
      edge: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.85 }),
      darkWood: new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.9 }),
      coin: new THREE.MeshStandardMaterial({ color: '#ffc531', metalness: 0.85, roughness: 0.25, emissive: '#4a3000' }),
      gateGlow: new THREE.MeshStandardMaterial({ color: '#3fd0ff', emissive: '#1a9fd8', emissiveIntensity: 0.8 }),
      lava: new THREE.MeshStandardMaterial({ color: '#ff6a1a', emissive: '#ff4a00', emissiveIntensity: 1.6 }),
      white: new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.4 }),
      black: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.2 }),
    };
    this.materials.ground.map.repeat.set(2, 2);
    this.materials.grass.map.repeat.set(16, 2);

    this.makeLights();
    this.makeSky();
    this.makeMountains();
    this.tiles = this.makeTrack();
    this.makeParticles();

    // Both dinosaurs are built; only the chosen one is shown.
    this.dinos = {
      rex: this.makeRex(getDino('rex')),
      trike: this.makeTrike(getDino('trike')),
    };

    this.models = new Map();
    this.scenery = [];

    this.levelIndex = -1;
    this.menuDistance = 0;
    this.shakeTime = 0;
    this.time = 0;

    this.resize();
  }

  part(shape, material, x, y, z, sx = 1, sy = 1, sz = 1) {
    const mesh = new THREE.Mesh(shape, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  addGroup(parts) {
    const group = new THREE.Group();
    for (const part of parts) {
      group.add(part);
    }
    this.scene.add(group);
    return group;
  }

  colour(colour, roughness = 0.7) {
    return new THREE.MeshStandardMaterial({ color: colour, roughness: roughness });
  }

  makeLights() {
    this.skyLight = new THREE.HemisphereLight('#ffffff', '#6b5a40', 1.3);
    this.scene.add(this.skyLight);

    this.sun = new THREE.DirectionalLight('#ffffff', 2.6);
    this.sun.position.set(-8, 18, 6);
    this.sun.target.position.set(0, 0, -10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -16;
    this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -14;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 70;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
  }

  makeSky() {
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColour: { value: new THREE.Color() },
        bottomColour: { value: new THREE.Color() },
      },
      vertexShader: `
        varying vec3 worldPosition;
        void main() {
          worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColour;
        uniform vec3 bottomColour;
        varying vec3 worldPosition;
        void main() {
          float height = normalize(worldPosition - cameraPosition).y;
          gl_FragColor = vec4(mix(bottomColour, topColour, smoothstep(0.0, 0.5, height)), 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.skyMaterial);
    this.scene.add(this.sky);
  }

  makeMountains() {
    this.mountainMaterial = new THREE.MeshBasicMaterial({ color: '#000000', fog: false });
    this.mountains = new THREE.Group();
    for (let i = 0; i < 30; i++) {
      // spread the mountains in a half circle in front of the camera
      const angle = Math.PI + (i / 29) * Math.PI;
      const distance = 260 + Math.sin(i * 7.3) * 30;
      const height = 40 + Math.abs(Math.sin(i * 3.1)) * 60;
      const width = 40 + Math.abs(Math.cos(i * 5.7)) * 40;
      const mountain = new THREE.Mesh(this.shapes.cone, this.mountainMaterial);
      mountain.position.set(Math.cos(angle) * distance, height / 2 - 15, Math.sin(angle) * distance);
      mountain.scale.set(width, height, width);
      this.mountains.add(mountain);
    }
    this.scene.add(this.mountains);
  }

  makeParticles() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 15;
      positions[i * 3 + 2] = -Math.random() * 100;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.15, map: makeDotTexture(), transparent: true, opacity: 0.8, depthWrite: false,
    });
    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  makeTrack() {
    const tiles = [];
    for (let i = 0; i < TILE_COUNT; i++) {
      const path = this.part(this.shapes.box, this.materials.ground, 0, -0.3, 0, TRACK_WIDTH, 0.6, TILE_LENGTH);
      const leftKerb = this.part(this.shapes.box, this.materials.edge, -TRACK_WIDTH / 2 - 0.3, -0.05, 0, 0.6, 0.6, TILE_LENGTH);
      const rightKerb = this.part(this.shapes.box, this.materials.edge, TRACK_WIDTH / 2 + 0.3, -0.05, 0, 0.6, 0.6, TILE_LENGTH);
      const grass = this.part(this.shapes.box, this.materials.grass, 0, -0.5, 0, 120, 0.4, TILE_LENGTH);
      path.castShadow = false;
      grass.castShadow = false;
      tiles.push(this.addGroup([path, leftKerb, rightKerb, grass]));
    }
    return tiles;
  }

  setLevel(levelIndex) {
    this.levelIndex = levelIndex;
    const level = LEVELS[levelIndex];

    this.scene.fog.color.set(level.fog);
    this.skyMaterial.uniforms.topColour.value.set(level.sky);
    this.skyMaterial.uniforms.bottomColour.value.set(level.skyLow);
    this.mountainMaterial.color.set(level.mountains);
    this.skyLight.groundColor.set(level.ground);
    this.sun.color.set(level.sun);

    this.materials.ground.color.set(level.ground);
    this.materials.grass.color.set(level.grass);
    this.materials.stone.color.set(level.stone);
    this.materials.edge.color.set(level.stone);

    if (level.scenery === 'jungle') this.particleMaterial.color.set('#fff6a8');
    if (level.scenery === 'desert') this.particleMaterial.color.set('#f3d9a8');
    if (level.scenery === 'volcano') this.particleMaterial.color.set('#ff8a2a');

    this.buildScenery(level.scenery);
  }

  buildScenery(theme) {
    for (const item of this.scenery) {
      this.scene.remove(item.big, item.small);
    }
    this.scenery = [];

    for (let i = 0; i < SCENERY_COUNT * 2; i++) {
      let big, small;
      if (theme === 'jungle') {
        big = i % 3 === 0 ? this.makePalm() : this.makeJungleTree();
        small = this.makeBush();
      } else if (theme === 'desert') {
        big = i % 3 === 0 ? this.makeMesa() : this.makeCactus();
        small = this.makeRock('#a8744a');
      } else {
        big = i % 3 === 0 ? this.makeSpire() : this.makeDeadTree();
        small = i % 2 === 0 ? this.makeLavaPool() : this.makeRock('#2e2826');
      }
      this.scenery.push({ big: big, small: small });
    }
  }

  makeJungleTree() {
    const leaves = this.colour('#2f6e2a', 0.9);
    const leaves2 = this.colour('#3f8a32', 0.9);
    return this.addGroup([
      this.part(this.shapes.cylinder, this.materials.wood, 0, 2, 0, 0.5, 4, 0.5),
      this.part(this.shapes.ball, leaves, 0, 4.6, 0, 3.4, 2.8, 3.4),
      this.part(this.shapes.ball, leaves2, 0.9, 4.0, 0.5, 2.4, 2.0, 2.4),
      this.part(this.shapes.ball, leaves2, -0.8, 4.2, -0.4, 2.2, 1.9, 2.2),
    ]);
  }

  makePalm() {
    const leaf = this.colour('#3c8a2e', 0.8);
    const parts = [];
    // a slightly bent trunk made of 5 pieces
    for (let i = 0; i < 5; i++) {
      parts.push(this.part(this.shapes.cylinder, this.materials.wood, i * 0.12, 0.6 + i * 1.2, 0, 0.42 - i * 0.04, 1.25, 0.42 - i * 0.04));
    }
    // 7 long flat leaves around the top
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const frond = this.part(this.shapes.ball, leaf, 0.6 + Math.cos(angle) * 1.3, 6.1, Math.sin(angle) * 1.3, 0.5, 0.15, 3);
      frond.rotation.y = -angle + Math.PI / 2;
      frond.rotation.x = 0.35;
      parts.push(frond);
    }
    return this.addGroup(parts);
  }

  makeBush() {
    const green = this.colour('#3d7a2c', 0.9);
    return this.addGroup([
      this.part(this.shapes.ball, green, 0, 0.4, 0, 1.6, 1.1, 1.4),
      this.part(this.shapes.ball, green, 0.7, 0.3, 0.2, 1.1, 0.8, 1.0),
    ]);
  }

  makeCactus() {
    const green = this.colour('#4f7f3a', 0.8);
    const parts = [this.part(this.shapes.cylinder, green, 0, 1.8, 0, 0.7, 3.6, 0.7)];
    parts.push(this.part(this.shapes.ball, green, 0, 3.6, 0, 0.7, 0.6, 0.7));
    // two arms
    for (const side of [-1, 1]) {
      parts.push(this.part(this.shapes.cylinder, green, side * 0.6, 1.6, 0, 0.6, 0.35, 0.4).rotateZ(Math.PI / 2));
      parts.push(this.part(this.shapes.cylinder, green, side * 0.85, 2.2, 0, 0.4, 1.2, 0.4));
    }
    return this.addGroup(parts);
  }

  makeMesa() {
    const rock = this.colour('#b56a3a', 1);
    const dark = this.colour('#8f4f2a', 1);
    return this.addGroup([
      this.part(this.shapes.box, rock, 0, 3, 0, 5, 6, 4),
      this.part(this.shapes.box, dark, 0, 1, 0, 5.3, 0.4, 4.3),
      this.part(this.shapes.box, dark, 0, 6.1, 0, 5.1, 0.3, 4.1),
    ]);
  }

  makeRock(colour) {
    const rock = new THREE.MeshStandardMaterial({ color: colour, roughness: 1, flatShading: true });
    return this.addGroup([
      this.part(this.shapes.rock, rock, 0, 0.35, 0, 1.6, 1.0, 1.3),
      this.part(this.shapes.rock, rock, 0.8, 0.2, 0.3, 0.8, 0.6, 0.8),
    ]);
  }

  makeDeadTree() {
    const bark = this.materials.darkWood;
    const trunk = this.part(this.shapes.cylinder, bark, 0, 2, 0, 0.35, 4, 0.35);
    const branch1 = this.part(this.shapes.cylinder, bark, 0.5, 3.2, 0, 0.15, 1.8, 0.15);
    branch1.rotation.z = -0.8;
    const branch2 = this.part(this.shapes.cylinder, bark, -0.45, 2.6, 0, 0.15, 1.5, 0.15);
    branch2.rotation.z = 0.9;
    return this.addGroup([trunk, branch1, branch2]);
  }

  makeSpire() {
    const basalt = new THREE.MeshStandardMaterial({ color: '#2a2220', roughness: 1, flatShading: true });
    return this.addGroup([
      this.part(this.shapes.cone, basalt, 0, 3, 0, 3, 6, 3),
      this.part(this.shapes.cone, basalt, 1.4, 1.8, 0.5, 1.6, 3.6, 1.6),
      this.part(this.shapes.cone, this.materials.lava, 0, 6.1, 0, 0.6, 0.3, 0.6),
    ]);
  }

  makeLavaPool() {
    const pool = this.part(this.shapes.cylinder, this.materials.lava, 0, -0.25, 0, 3, 0.1, 2.2);
    pool.castShadow = false;
    return this.addGroup([pool, this.part(this.shapes.rock, this.colour('#2e2826', 1), 1.6, 0.2, 0.3, 0.9, 0.6, 0.8)]);
  }

  makeRex(dino) {
    const skin = this.colour(dino.skin, 0.65);
    const belly = this.colour(dino.belly, 0.7);
    const body = new THREE.Group();

    // body
    body.add(this.part(this.shapes.ball, skin, 0, 1.55, 0, 1.15, 1.15, 1.9));
    body.add(this.part(this.shapes.ball, belly, 0, 1.35, -0.25, 0.9, 0.85, 1.3));
    // neck
    body.add(this.part(this.shapes.ball, skin, 0, 2.2, -0.75, 0.75, 0.9, 0.8));

    // head (a group so it can nod), with a jaw that opens a little
    const head = new THREE.Group();
    head.position.set(0, 2.55, -1.1);
    head.add(this.part(this.shapes.ball, skin, 0, 0, -0.2, 0.85, 0.75, 1.3));
    head.add(this.part(this.shapes.ball, skin, 0, -0.08, -0.75, 0.65, 0.5, 0.8));
    for (const side of [-1, 1]) {
      head.add(this.part(this.shapes.ball, this.materials.white, side * 0.33, 0.15, -0.35, 0.2, 0.2, 0.2));
      head.add(this.part(this.shapes.ball, this.materials.black, side * 0.39, 0.16, -0.4, 0.1, 0.1, 0.1));
      head.add(this.part(this.shapes.ball, skin, side * 0.25, 0.3, -0.3, 0.25, 0.1, 0.35));
    }
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.25, -0.1);
    jaw.add(this.part(this.shapes.ball, belly, 0, -0.05, -0.55, 0.55, 0.25, 1.0));
    // teeth along the top jaw
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      head.add(this.part(this.shapes.cone, this.materials.white, side * 0.22, -0.3, -0.45 - Math.floor(i / 2) * 0.2, 0.06, 0.14, 0.06).rotateX(Math.PI));
    }
    head.add(jaw);
    body.add(head);

    // tiny arms with claws
    for (const side of [-1, 1]) {
      const arm = this.part(this.shapes.cylinder, skin, side * 0.5, 1.75, -0.95, 0.12, 0.45, 0.12);
      arm.rotation.x = -0.9;
      body.add(arm);
      body.add(this.part(this.shapes.cone, this.materials.white, side * 0.5, 1.6, -1.15, 0.05, 0.12, 0.05).rotateX(-1.8));
    }

    const legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.5, 1.35, 0.2);
      hip.add(this.part(this.shapes.ball, skin, 0, -0.25, 0.05, 0.55, 1.0, 0.75));
      hip.add(this.part(this.shapes.cylinder, skin, 0, -0.85, 0.2, 0.26, 0.7, 0.26));
      hip.add(this.part(this.shapes.box, skin, 0, -1.25, 0.0, 0.34, 0.16, 0.6));
      for (let c = -1; c <= 1; c++) {
        hip.add(this.part(this.shapes.cone, this.materials.white, c * 0.1, -1.27, -0.35, 0.05, 0.14, 0.05).rotateX(-Math.PI / 2));
      }
      body.add(hip);
      legs.push(hip);
    }

    const tail = this.makeTail(body, skin, 0, 1.5, 0.9, 0.6);

    const root = this.addGroup([body]);
    root.scale.setScalar(0.85);
    return { type: 'biped', root: root, body: body, legs: legs, tail: tail, head: head, jaw: jaw };
  }

  makeTrike(dino) {
    const skin = this.colour(dino.skin, 0.75);
    const belly = this.colour(dino.belly, 0.8);
    const horn = this.colour('#efe6cf', 0.4);
    const body = new THREE.Group();

    // big round body, low to the ground
    body.add(this.part(this.shapes.ball, skin, 0, 1.35, 0.1, 1.7, 1.45, 2.6));
    body.add(this.part(this.shapes.ball, belly, 0, 1.0, 0.1, 1.4, 0.9, 2.2));

    // head with frill, horns and beak
    const head = new THREE.Group();
    head.position.set(0, 1.5, -1.45);
    head.add(this.part(this.shapes.ball, skin, 0, 0, -0.35, 1.0, 0.85, 1.2));
    const frill = this.part(this.shapes.cylinder, this.colour('#7d9a52', 0.7), 0, 0.4, 0.1, 1.9, 0.15, 1.5);
    frill.rotation.x = -1.15;
    head.add(frill);
    head.add(this.part(this.shapes.cone, horn, 0.3, 0.55, -0.55, 0.13, 1.0, 0.13).rotateX(-1.1));
    head.add(this.part(this.shapes.cone, horn, -0.3, 0.55, -0.55, 0.13, 1.0, 0.13).rotateX(-1.1));
    head.add(this.part(this.shapes.cone, horn, 0, 0.0, -1.0, 0.12, 0.45, 0.12).rotateX(-1.3));
    head.add(this.part(this.shapes.cone, this.colour('#3b3226', 0.5), 0, -0.25, -0.95, 0.3, 0.4, 0.3).rotateX(-2.2));
    for (const side of [-1, 1]) {
      head.add(this.part(this.shapes.ball, this.materials.white, side * 0.38, 0.12, -0.6, 0.17, 0.17, 0.17));
      head.add(this.part(this.shapes.ball, this.materials.black, side * 0.43, 0.12, -0.64, 0.09, 0.09, 0.09));
    }
    body.add(head);

    // four short, thick legs (front pair and back pair)
    const legs = [];
    for (const z of [-0.8, 0.9]) {
      for (const side of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.65, 1.0, z);
        hip.add(this.part(this.shapes.cylinder, skin, 0, -0.45, 0, 0.42, 0.95, 0.42));
        hip.add(this.part(this.shapes.cylinder, belly, 0, -0.95, -0.03, 0.46, 0.12, 0.5));
        body.add(hip);
        legs.push(hip);
      }
    }

    const tail = this.makeTail(body, skin, 0, 1.25, 1.4, 0.55);

    const root = this.addGroup([body]);
    return { type: 'quadruped', root: root, body: body, legs: legs, tail: tail, head: head, jaw: null };
  }

  makeTail(body, material, x, y, z, size) {
    const pieces = [];
    let parent = body;
    let radius = size;
    let offset = new THREE.Vector3(x, y, z);
    for (let i = 0; i < 5; i++) {
      const piece = new THREE.Group();
      piece.position.copy(offset);
      piece.add(this.part(this.shapes.ball, material, 0, 0, 0.3, radius, radius * 0.9, radius * 1.8));
      parent.add(piece);
      pieces.push(piece);
      parent = piece;
      offset = new THREE.Vector3(0, -0.05, radius * 0.75);
      radius = radius * 0.75;
    }
    return pieces;
  }

  makeObstacle(type) {
    if (type === 'rock') {
      const rock = this.part(this.shapes.rock, this.materials.stone, 0, 0.45, 0, 2.1, 1.15, 1.7);
      rock.rotation.y = Math.random() * Math.PI;
      const small = this.part(this.shapes.rock, this.materials.stone, 0.7, 0.25, 0.4, 0.8, 0.6, 0.8);
      return this.addGroup([rock, small]);
    }
    if (type === 'pillar') {
      // a stone column with a base and a top
      return this.addGroup([
        this.part(this.shapes.cylinder, this.materials.stone, 0, 3.25, 0, 1.2, 6.5, 1.2),
        this.part(this.shapes.box, this.materials.edge, 0, 0.2, 0, 1.6, 0.4, 1.6),
        this.part(this.shapes.box, this.materials.edge, 0, 6.5, 0, 1.7, 0.4, 1.7),
      ]);
    }
    const log = this.part(this.shapes.cylinder, this.materials.wood, 0, 1.55, 0, 0.8, LANE_WIDTH, 0.8);
    log.rotation.z = Math.PI / 2;
    return this.addGroup([
      log,
      this.part(this.shapes.box, this.materials.stone, -LANE_WIDTH / 2 + 0.15, 1, 0, 0.35, 2, 0.6),
      this.part(this.shapes.box, this.materials.stone, LANE_WIDTH / 2 - 0.15, 1, 0, 0.35, 2, 0.6),
    ]);
  }

  makeCoin() {
    // turned to face the camera and spun in updateObjects()
    return this.addGroup([this.part(this.shapes.coin, this.materials.coin, 0, 0, 0)]);
  }

  makeGate() {
    const half = TRACK_WIDTH / 2 + 0.8;
    const doorWidth = half - 0.7;

    const doors = [];
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.x = side * doorWidth;
      hinge.add(this.part(this.shapes.box, this.materials.wood, -side * doorWidth / 2, 3.6, 0, doorWidth, 7.2, 0.3));
      // metal bands across the door
      for (let i = 0; i < 3; i++) {
        hinge.add(this.part(this.shapes.box, this.materials.black, -side * doorWidth / 2, 1.2 + i * 2.4, 0.17, doorWidth, 0.15, 0.04));
      }
      hinge.add(this.part(this.shapes.ball, this.materials.gateGlow, -side * 0.35, 4, 0.2, 0.6, 0.9, 0.1));
      hinge.userData.side = side;
      doors.push(hinge);
    }

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), new THREE.MeshBasicMaterial({ map: makeSignTexture() }));
    sign.position.set(0, 8.5, 0.85);

    const gate = this.addGroup([
      doors[0],
      doors[1],
      this.part(this.shapes.box, this.materials.stone, -half, 4.2, 0, 1.6, 8.4, 1.6),
      this.part(this.shapes.box, this.materials.stone, half, 4.2, 0, 1.6, 8.4, 1.6),
      this.part(this.shapes.box, this.materials.edge, 0, 8.5, 0, half * 2 + 2, 1.6, 1.6),
      this.part(this.shapes.ball, this.materials.gateGlow, -half, 9.6, 0, 0.9, 0.9, 0.9),
      this.part(this.shapes.ball, this.materials.gateGlow, half, 9.6, 0, 0.9, 0.9, 0.9),
      sign,
    ]);
    gate.userData.doors = doors;
    return gate;
  }

  // Called when the dino is hit (through the EventBus).
  shake() {
    this.shakeTime = 0.4;
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.webgl.setSize(width, height, false);
    this.camera.aspect = width / height;

    if (width < height) {
      this.camera.fov = 75;
    } else {
      this.camera.fov = 60;
    }
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.webgl.dispose();
  }

  render(dt, runner, menuChoice) {
    this.time = this.time + dt;

    let distance, player, speed, levelIndex, dinoId;
    if (runner !== null) {
      distance = runner.distance;
      player = runner.player;
      speed = runner.speed;
      levelIndex = runner.levelIndex;
      dinoId = runner.dino.id;
    } else {
      // Menu: the chosen dino jogs through the chosen level
      speed = 7;
      this.menuDistance = this.menuDistance + speed * dt;
      distance = this.menuDistance;
      player = { x: 0, y: 0, jumping: false, sliding: false, hurtTimer: 0 };
      levelIndex = menuChoice.level;
      dinoId = menuChoice.dino;
    }

    if (levelIndex !== this.levelIndex) {
      this.setLevel(levelIndex);
    }

    this.updateObjects(runner, distance);
    this.animateDino(dinoId, player, speed);
    this.moveScenery(distance);
    this.moveParticles(dt, speed);
    this.moveCamera(dt, player, speed);

    this.webgl.render(this.scene, this.camera);
  }

  animateDino(dinoId, player, speed) {
    for (const id of Object.keys(this.dinos)) {
      this.dinos[id].root.visible = id === dinoId;
    }
    const dino = this.dinos[dinoId];
    dino.root.position.set(player.x, player.y, 0);

    const running = speed > 0.5;
    const cycle = this.time * (5 + speed * 0.45);
    const swing = running ? Math.sin(cycle) : 0;

    for (let i = 0; i < dino.legs.length; i++) {
      let direction = i % 2 === 0 ? 1 : -1;
      if (dino.type === 'quadruped' && i >= 2) {
        direction = -direction;
      }
      if (player.jumping) {
        dino.legs[i].rotation.x = -0.5;
      } else {
        dino.legs[i].rotation.x = swing * 0.7 * direction;
      }
    }

    for (let i = 0; i < dino.tail.length; i++) {
      dino.tail[i].rotation.y = Math.sin(cycle * 0.5 - i * 0.6) * 0.12;
      dino.tail[i].rotation.x = -0.04 + Math.sin(cycle - i * 0.5) * 0.04;
    }

    dino.head.rotation.x = running ? Math.sin(cycle * 2) * 0.05 : Math.sin(this.time * 1.5) * 0.04;
    if (dino.jaw !== null) {
      dino.jaw.rotation.x = 0.1 + Math.abs(Math.sin(cycle * 0.5)) * 0.1;
    }

    if (player.sliding) {
      dino.body.rotation.x = -0.5;
      dino.body.position.y = -0.55;
    } else {
      dino.body.rotation.x = running ? -0.05 : 0;
      dino.body.position.y = running && !player.jumping ? Math.abs(swing) * 0.12 : 0;
    }
    dino.body.rotation.z = Math.sin(cycle) * 0.03;

    if (player.hurtTimer > 0) {
      dino.body.visible = Math.floor(this.time * 12) % 2 === 0;
    } else {
      dino.body.visible = true;
    }
  }

  moveScenery(distance) {
    const firstTile = Math.floor(distance / TILE_LENGTH) - 2;
    for (let i = 0; i < this.tiles.length; i++) {
      const tileMiddle = (firstTile + i) * TILE_LENGTH + TILE_LENGTH / 2;
      this.tiles[i].position.z = -(tileMiddle - distance);
    }

    const firstSlot = Math.floor(distance / SCENERY_SPACING) - 2;
    for (let i = 0; i < this.scenery.length; i++) {
      const slot = firstSlot + Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;

      const random1 = Math.abs(Math.sin(slot * 12.9898 + side * 4.1));
      const random2 = Math.abs(Math.sin(slot * 78.233 + side * 1.7));

      const z = -(slot * SCENERY_SPACING - distance);
      const item = this.scenery[i];
      item.big.position.set(side * (TRACK_WIDTH / 2 + 5 + random1 * 12), -0.3, z);
      item.big.scale.setScalar(0.8 + random2 * 0.6);
      item.big.rotation.y = random1 * Math.PI * 2;
      item.small.position.set(side * (TRACK_WIDTH / 2 + 1.5 + random2 * 2), -0.3, z + 3);
      item.small.scale.setScalar(0.6 + random1 * 0.6);
    }
  }

  // Particles drift slowly and move past with the world.
  moveParticles(dt, speed) {
    const positions = this.particles.geometry.attributes.position.array;
    const rising = this.levelIndex === 2 ? 1.5 : 0.2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3 + 1] = positions[i * 3 + 1] + rising * dt;
      positions[i * 3 + 2] = positions[i * 3 + 2] + speed * dt;
      if (positions[i * 3 + 2] > 10) positions[i * 3 + 2] = positions[i * 3 + 2] - 110;
      if (positions[i * 3 + 1] > 15) positions[i * 3 + 1] = 0;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  updateObjects(runner, distance) {
    const stillUsed = new Set();

    if (runner !== null) {
      for (const obstacle of runner.obstacles) {
        const model = this.getModel(obstacle.id, () => this.makeObstacle(obstacle.type));
        model.position.set(laneToX(obstacle.lane), 0, -(obstacle.at - distance));
        stillUsed.add(obstacle.id);
      }

      for (const coin of runner.coins) {
        const model = this.getModel(coin.id, () => this.makeCoin());
        const bob = Math.sin(this.time * 3 + coin.id) * 0.1;
        model.position.set(laneToX(coin.lane), 1 + bob, -(coin.at - distance));
        model.rotation.set(Math.PI / 2, 0, this.time * 3);
        stillUsed.add(coin.id);
      }

      for (const gate of runner.gates) {
        const id = 'gate' + gate.at;
        const model = this.getModel(id, () => this.makeGate());
        model.position.z = -(gate.at - distance) - 3.5;

        for (const door of model.userData.doors) {
          let target = 0;
          if (gate.open) {
            target = door.userData.side * 1.7;
          }
          door.rotation.y = door.rotation.y + (target - door.rotation.y) * 0.06;
        }
        stillUsed.add(id);
      }
    }

    for (const [id, model] of this.models) {
      if (!stillUsed.has(id)) {
        this.scene.remove(model);
        this.models.delete(id);
      }
    }
  }

  getModel(id, createModel) {
    if (!this.models.has(id)) {
      this.models.set(id, createModel());
    }
    return this.models.get(id);
  }

  moveCamera(dt, player, speed) {
    const cam = this.camera;

    if (this.cameraBase === undefined) {
      this.cameraBase = new THREE.Vector3(0, 4.8, 8.2);
    }
    const amount = 1 - Math.exp(-6 * dt);
    const targetX = player.x * 0.5;
    const targetY = 4.8 + player.y * 0.3;
    this.cameraBase.x = this.cameraBase.x + (targetX - this.cameraBase.x) * amount;
    this.cameraBase.y = this.cameraBase.y + (targetY - this.cameraBase.y) * amount;

    let extraX = 0;
    let extraY = 0;

    if (speed > 0.5) {
      extraY = Math.sin(this.time * 10) * 0.015;
    }

    if (this.shakeTime > 0 && dt > 0) {
      this.shakeTime = this.shakeTime - dt;
      extraX = extraX + (Math.random() - 0.5) * 0.4;
      extraY = extraY + (Math.random() - 0.5) * 0.4;
    }

    cam.position.set(this.cameraBase.x + extraX, this.cameraBase.y + extraY, this.cameraBase.z);

    cam.lookAt(player.x * 0.3, 1.4, -10);

    this.sky.position.copy(cam.position);
    this.mountains.position.set(cam.position.x, 0, cam.position.z);
  }
}

function makeDirtTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#e8e2d8';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1800; i++) {
    const shade = 160 + Math.floor(Math.random() * 95);
    g.fillStyle = 'rgba(' + shade + ',' + (shade - 8) + ',' + (shade - 20) + ',0.5)';
    g.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(120,110,100,0.6)';
    g.beginPath();
    g.ellipse(Math.random() * size, Math.random() * size, 2 + Math.random() * 4, 2 + Math.random() * 3, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return finishTexture(canvas);
}

// Grass / sand: light base with thin random strokes.
function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    const shade = 150 + Math.floor(Math.random() * 105);
    g.strokeStyle = 'rgba(' + shade + ',' + shade + ',' + shade + ',0.6)';
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4);
    g.stroke();
  }
  return finishTexture(canvas);
}

// The "FISH GATE" sign above the gate.
function makeSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const g = canvas.getContext('2d');
  g.fillStyle = '#1f5f7a';
  g.fillRect(0, 0, 512, 112);
  g.strokeStyle = '#ffd36b';
  g.lineWidth = 8;
  g.strokeRect(6, 6, 500, 100);
  g.fillStyle = '#fff6d6';
  g.font = 'bold 58px "Lilita One", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('FISH GATE', 256, 60);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

function finishTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
