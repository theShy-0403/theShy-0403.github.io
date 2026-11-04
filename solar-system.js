import * as THREE from 'three';
import {OrbitControls} from './assets/vendor/OrbitControls.js';

// 球面纹理来自 Solar System Scope（CC BY 4.0）；尺寸、距离和速度为阅读体验调整。
const PLANETS = [
  {id:'mercury', name:'水星', english:'MERCURY', radius:.32, orbit:4.7, period:22, phase:.2, tilt:.03, color:'#bcb3a7', texture:'2k_mercury.jpg', description:'布满撞击坑的岩石表面，留下漫长岁月的痕迹。'},
  {id:'venus', name:'金星', english:'VENUS', radius:.53, orbit:6.3, period:32, phase:2.4, tilt:3.1, color:'#dbc28d', texture:'2k_venus_surface.jpg', description:'云层之下的岩石世界。这里展示的是金星的表面纹理。'},
  {id:'earth', name:'地球', english:'EARTH', radius:.57, orbit:8, period:45, phase:4.6, tilt:.41, color:'#6faee1', texture:'2k_earth_daymap.jpg', description:'蓝色海洋、陆地与流动的云层。这是我们的家。'},
  {id:'mars', name:'火星', english:'MARS', radius:.4, orbit:9.8, period:58, phase:1.1, tilt:.44, color:'#d48a63', texture:'2k_mars.jpg', description:'铁锈色的大地、古老的陨坑，与遥远的探索梦想。'},
  {id:'jupiter', name:'木星', english:'JUPITER', radius:1.45, orbit:13.5, period:95, phase:5.7, tilt:.05, color:'#d6b69a', texture:'2k_jupiter.jpg', description:'层叠的云带与巨大的风暴，勾勒出气态巨行星的轮廓。'},
  {id:'saturn', name:'土星', english:'SATURN', radius:1.2, orbit:17.6, period:130, phase:2.5, tilt:.47, color:'#dbcb9c', texture:'2k_saturn.jpg', description:'无数冰粒与岩屑组成的光环，环绕着淡金色的星球。'},
  {id:'uranus', name:'天王星', english:'URANUS', radius:.8, orbit:21.8, period:170, phase:3.8, tilt:1.71, color:'#9ddbe2', texture:'2k_uranus.jpg', description:'淡青色的冰巨星，以近乎侧躺的姿态绕太阳运行。'},
  {id:'neptune', name:'海王星', english:'NEPTUNE', radius:.77, orbit:25.5, period:210, phase:5.1, tilt:.49, color:'#7599dc', texture:'2k_neptune.jpg', description:'遥远的蓝色世界，云层下是深邃而活跃的大气。'}
];
const SUN = {id:'sun', name:'太阳', english:'SUN', radius:2.6, color:'#ffd18b', description:'太阳系中心的恒星，光与热从这里出发。'};
const icon = path => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
let pausedPreference;

export function mountSolarSystem(card, motion) {
  const canvas = card.querySelector('canvas');
  const stage = card.querySelector('.solar-stage');
  const expand = card.querySelector('.solar-expand');
  const hint = card.querySelector('.solar-hint');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .05, 600);
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI - .12;
  controls.rotateSpeed = .55;
  controls.zoomSpeed = .7;
  const events = new AbortController();
  const resources = new Set();
  const track = value => { resources.add(value); return value; };
  const sphere = track(new THREE.SphereGeometry(1, 64, 40));
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  let disposed = false, expanded = false, visible = false, contextLost = false;
  let paused = motion.matches || (pausedPreference ?? false);
  let frame = 0, lastTime = 0, elapsed = 0, transition = null, selected = null;
  let focusedBeforeOpen, savedOverflow;
  const textures = new Map();
  function texture(file, color = true) {
    if (textures.has(file)) return textures.get(file);
    const map = track(loader.load(`./assets/solar/${file}`, () => {
      if (disposed) { map.dispose(); return; }
      requestDraw();
    }));
    map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    textures.set(file, map);
    return map;
  }
  const ambient = new THREE.AmbientLight('#a8bdde', .28);
  const sunlight = new THREE.PointLight('#fff3db', 3.2, 0, 0);
  scene.add(ambient, sunlight);
  const sunRoot = new THREE.Group();
  const sunMaterial = track(new THREE.MeshBasicMaterial({map:texture('2k_sun.jpg'),color:'#fff4d9',toneMapped:false}));
  const sunMesh = new THREE.Mesh(sphere, sunMaterial);
  sunMesh.scale.setScalar(SUN.radius);
  sunRoot.add(sunMesh); scene.add(sunRoot);
  // 日冕是叠在真实球体外的透明光晕，不把星球本身画成扁平光点。
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const brush = glowCanvas.getContext('2d');
  const gradient = brush.createRadialGradient(64, 64, 14, 64, 64, 64);
  gradient.addColorStop(0, '#ffcd7860'); gradient.addColorStop(.35, '#ffb34725'); gradient.addColorStop(1, '#ff9d0000');
  brush.fillStyle = gradient; brush.fillRect(0, 0, 128, 128);
  const glowMap = track(new THREE.CanvasTexture(glowCanvas));
  const corona = new THREE.Sprite(track(new THREE.SpriteMaterial({map:glowMap,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false})));
  corona.scale.set(14, 14, 1); sunRoot.add(corona);
  const orbits = new THREE.Group(); scene.add(orbits);
  const orbitMaterial = track(new THREE.LineBasicMaterial({color:'#8092ba',transparent:true,opacity:.17}));
  const bodies = PLANETS.map(data => {
    const root = new THREE.Group();
    const axial = new THREE.Group(); axial.rotation.z = data.tilt; root.add(axial);
    const map = texture(data.texture);
    const material = track(new THREE.MeshStandardMaterial({map,roughness:.92,metalness:0}));
    if (data.id === 'mercury' || data.id === 'mars') { material.bumpMap = map; material.bumpScale = .013; }
    const mesh = new THREE.Mesh(sphere, material); mesh.scale.setScalar(data.radius); axial.add(mesh);
    scene.add(root);
    const points = Array.from({length:192}, (_, i) => {
      const angle = i / 192 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * data.orbit, 0, Math.sin(angle) * data.orbit);
    });
    orbits.add(new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(points)), orbitMaterial));
    let clouds;
    if (data.id === 'earth') {
      clouds = new THREE.Mesh(sphere, track(new THREE.MeshStandardMaterial({color:'#ffffff',alphaMap:texture('2k_earth_clouds.jpg',false),transparent:true,opacity:.7,depthWrite:false,roughness:1})));
      clouds.scale.setScalar(data.radius * 1.018); axial.add(clouds);
      const atmosphere = new THREE.Mesh(sphere, track(new THREE.ShaderMaterial({
        uniforms:{tint:{value:new THREE.Color('#65bfff')}},
        vertexShader:'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
        fragmentShader:'uniform vec3 tint; varying vec3 n; varying vec3 v; void main(){ float rim=pow(1.0-max(dot(normalize(n),normalize(v)),0.0),3.5); gl_FragColor=vec4(tint,rim*0.32); }',
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
      })));
      atmosphere.scale.setScalar(data.radius * 1.045); axial.add(atmosphere);
    }
    if (data.id === 'saturn') {
      const inner = data.radius * 1.3, outer = data.radius * 2.25;
      const geometry = track(new THREE.RingGeometry(inner, outer, 144));
      const position = geometry.attributes.position, uv = geometry.attributes.uv;
      for (let i = 0; i < position.count; i++) uv.setXY(i, (Math.hypot(position.getX(i),position.getY(i)) - inner) / (outer - inner), .5);
      const ringMap = texture('2k_saturn_ring_alpha.png');
      // 补少量散射光，防止薄环的背光面在小尺寸屏幕上完全融入背景。
      const ring = new THREE.Mesh(geometry, track(new THREE.MeshStandardMaterial({map:ringMap,emissiveMap:ringMap,emissive:'#d3c3ab',emissiveIntensity:.6,side:THREE.DoubleSide,transparent:true,alphaTest:.04,roughness:1,depthWrite:false})));
      ring.rotation.x = -Math.PI / 2; axial.add(ring);
    }
    return {...data,root,axial,mesh,clouds};
  });
  const sun = {...SUN,root:sunRoot,mesh:sunMesh};
  const allBodies = [sun,...bodies];
  const moon = new THREE.Mesh(sphere,track(new THREE.MeshStandardMaterial({map:texture('2k_moon.jpg'),roughness:1})));
  moon.scale.setScalar(.15); bodies.find(body => body.id === 'earth').root.add(moon);
  const starPositions = [], starColors = [];
  let seed = 42;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 1400; i++) {
    const azimuth = random() * Math.PI * 2, elevation = Math.acos(2 * random() - 1), radius = 95 + random() * 130;
    starPositions.push(radius * Math.sin(elevation) * Math.cos(azimuth), radius * Math.cos(elevation), radius * Math.sin(elevation) * Math.sin(azimuth));
    const light = .3 + random() * .6; starColors.push(light*.88,light*.92,light);
  }
  const starGeometry = track(new THREE.BufferGeometry());
  starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  scene.add(new THREE.Points(starGeometry,track(new THREE.PointsMaterial({size:.17,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}))));

  const dialog = document.createElement('dialog');
  dialog.className = 'solar-dialog'; dialog.setAttribute('aria-labelledby','solar-dialog-title');
  dialog.innerHTML = `<div class="solar-toolbar"><div><h2 id="solar-dialog-title">漫游太阳系</h2><small>THE SOLAR SYSTEM</small></div><div class="solar-toolbar-actions"><button class="solar-control" data-action="pause" type="button" aria-label="暂停公转" title="暂停公转">${icon('M8 6v12M16 6v12')}</button><button class="solar-control" data-action="reset" type="button" aria-label="回到太阳系全景" title="回到全景">${icon('M4 10a8 8 0 1 1 1 8M4 4v6h6')}</button><button class="solar-control" data-action="close" type="button" aria-label="关闭太阳系" title="关闭（Esc）" autofocus>${icon('m6 6 12 12M18 6 6 18')}</button></div></div><div class="solar-view"></div><div class="solar-info" aria-live="polite"><small>SOLAR SYSTEM</small><h3>一隅星海</h3><p>点击一颗行星，靠近它的世界。</p></div><div class="solar-navigation"><div class="solar-planets" role="group" aria-label="选择天体"><button class="solar-planet" data-planet="overview" type="button" aria-pressed="true"><i style="--planet-color:#aaa5cb"></i>全景</button>${allBodies.map(body => `<button class="solar-planet" data-planet="${body.id}" type="button" aria-pressed="false"><i style="--planet-color:${body.color}"></i>${body.name}</button>`).join('')}</div><div class="solar-help"><span>拖动旋转 · 滚轮 / 双指缩放 · 尺寸与距离经视觉调整</span><a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">纹理：Solar System Scope · CC BY 4.0 ↗</a></div></div>`;
  document.body.append(dialog);
  const view = dialog.querySelector('.solar-view');
  const info = dialog.querySelector('.solar-info');
  const pauseButton = dialog.querySelector('[data-action=pause]');
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const target = new THREE.Vector3();
  const destination = new THREE.Vector3();
  function overviewDistance() {
    // 纵向手机屏幕按水平视野计算，最外层行星不会被边缘裁掉。
    return Math.max(72, 31 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect);
  }
  function setView(body, animate = true) {
    selected = body;
    allBodies.forEach(item => { item.root.visible = !body || item === body; });
    orbits.visible = !body;
    controls.minDistance = body ? body.radius * 2.8 : 28;
    controls.maxDistance = body ? body.radius * 18 : 190;
    if (body) {
      target.copy(body.root.position);
      const direction = body.id === 'sun' ? new THREE.Vector3(0,.3,1) : body.root.position.clone().negate().normalize();
      if (body.id === 'saturn') {
        // 从土星环平面上方靠近，避免默认镜头刚好把光环看成一条细线。
        direction.addScaledVector(new THREE.Vector3(0,1,0).applyEuler(body.axial.rotation),1.15);
      } else if (body.id !== 'sun') direction.add(new THREE.Vector3(0,.45,.25));
      direction.normalize();
      const distance = body.radius * (body.id === 'saturn' ? 8.5 : 6.5) / Math.min(1,camera.aspect);
      destination.copy(target).addScaledVector(direction,distance);
      info.querySelector('small').textContent = body.english;
      info.querySelector('h3').textContent = body.name;
      info.querySelector('p').textContent = body.description;
    } else {
      target.set(0,0,0);
      destination.set(.18,.62,1).normalize().multiplyScalar(overviewDistance());
      info.querySelector('small').textContent = 'SOLAR SYSTEM';
      info.querySelector('h3').textContent = '一隅星海';
      info.querySelector('p').textContent = '点击一颗行星，靠近它的世界。';
    }
    dialog.querySelectorAll('[data-planet]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.planet === (body?.id || 'overview'))));
    if (animate && !motion.matches) {
      transition = {start:performance.now(),from:camera.position.clone(),fromTarget:controls.target.clone(),to:destination.clone(),toTarget:target.clone()};
      controls.enabled = false;
    } else {
      transition = null; camera.position.copy(destination); controls.target.copy(target); controls.enabled = expanded;
      controls.update();
    }
    requestDraw();
  }
  function placeBodies(delta) {
    bodies.forEach(body => {
      const angle = body.phase + elapsed / body.period * Math.PI * 2;
      if (!selected) body.root.position.set(Math.cos(angle)*body.orbit,0,Math.sin(angle)*body.orbit);
      body.mesh.rotation.y += delta * (body.id === 'venus' || body.id === 'uranus' ? -.035 : .06);
      if (body.clouds) body.clouds.rotation.y += delta * .072;
    });
    sunMesh.rotation.y += delta * .018;
    moon.position.set(Math.cos(elapsed*.5)*1.08,.12,Math.sin(elapsed*.5)*1.08);
  }
  function draw(now) {
    frame = 0;
    if (disposed || contextLost || document.hidden || (!visible && !expanded)) return;
    const delta = lastTime ? Math.min((now - lastTime) / 1000,.05) : 0;
    lastTime = now;
    if (!paused) { if (!selected) elapsed += delta; placeBodies(delta); }
    if (transition) {
      const progress = Math.min(1,(now - transition.start) / 850);
      const easing = 1 - Math.pow(1-progress,3);
      camera.position.lerpVectors(transition.from,transition.to,easing);
      controls.target.lerpVectors(transition.fromTarget,transition.toTarget,easing);
      if (progress === 1) { transition = null; controls.enabled = expanded; }
    }
    controls.update();
    renderer.render(scene,camera);
    if (!paused || transition) requestDraw();
  }
  function requestDraw() {
    if (!frame && !disposed && !contextLost && !document.hidden && (visible || expanded)) frame = requestAnimationFrame(draw);
  }
  function resize() {
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    renderer.setSize(bounds.width,bounds.height,false);
    camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix();
    setView(expanded ? selected : null,false);
    requestDraw();
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    card.dataset.motion = !paused && !document.hidden && (visible || expanded) ? 'running' : 'paused';
    pauseButton.setAttribute('aria-label',paused ? '播放公转' : '暂停公转');
    pauseButton.title = paused ? '播放公转' : '暂停公转';
    pauseButton.setAttribute('aria-pressed',String(paused));
    pauseButton.innerHTML = icon(paused ? 'm9 5 10 7-10 7Z' : 'M8 6v12M16 6v12');
    requestDraw();
  }
  function close() {
    if (!expanded) return;
    expanded = false; card.append(stage); controls.enabled = false;
    document.body.style.overflow = savedOverflow;
    resize(); sync();
    if (focusedBeforeOpen?.isConnected) focusedBeforeOpen.focus({preventScroll:true});
  }
  expand.addEventListener('click', () => {
    focusedBeforeOpen = document.activeElement;
    savedOverflow = document.body.style.overflow;
    expanded = true; dialog.showModal(); view.append(stage); document.body.style.overflow = 'hidden';
    controls.enabled = true; resize(); setView(null,false); sync();
  }, {signal:events.signal});
  dialog.addEventListener('close',close,{signal:events.signal});
  dialog.addEventListener('click',event => {
    if (event.target === dialog) dialog.close();
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') dialog.close();
    if (action === 'reset') setView(null);
    if (action === 'pause') { paused = !paused; pausedPreference = paused; sync(); }
    const planet = event.target.closest('[data-planet]')?.dataset.planet;
    if (planet) setView(allBodies.find(body => body.id === planet) || null);
  },{signal:events.signal});
  let down = null;
  canvas.addEventListener('pointerdown',event => { down = {x:event.clientX,y:event.clientY}; },{signal:events.signal});
  canvas.addEventListener('pointerup',event => {
    if (!expanded || !down || Math.hypot(event.clientX-down.x,event.clientY-down.y)>6) { down = null; return; }
    down = null;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit = raycaster.intersectObjects(allBodies.filter(body=>body.root.visible).map(body=>body.mesh),false)[0];
    if (hit) setView(allBodies.find(body=>body.mesh===hit.object));
  },{signal:events.signal});
  canvas.addEventListener('pointercancel',() => { down = null; },{signal:events.signal});
  controls.addEventListener('change',requestDraw);
  document.addEventListener('visibilitychange',sync,{signal:events.signal});
  motion.addEventListener('change',() => { paused = motion.matches; pausedPreference = paused; controls.enableDamping = !motion.matches; if (transition) setView(selected,false); sync(); },{signal:events.signal});
  controls.enableDamping = !motion.matches;
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0;
    hint.textContent = '画面暂时中断，正在恢复…';
  },{signal:events.signal});
  canvas.addEventListener('webglcontextrestored',() => { contextLost = false; hint.textContent = '点击放大 · 漫游太阳系'; resize(); sync(); },{signal:events.signal});
  const viewport = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  const size = new ResizeObserver(resize); size.observe(stage); viewport.observe(card);
  manager.onLoad = () => { if (!disposed) { hint.textContent = '点击放大 · 漫游太阳系'; requestDraw(); } };
  manager.onError = () => { if (!disposed) hint.textContent = '点击放大 · 部分纹理尚未加载'; };
  placeBodies(0); resize(); sync();
  // 同一画布在卡片与弹层间移动；退出路由时显式释放 GPU、贴图和事件。
  return () => {
    disposed = true; cancelAnimationFrame(frame); events.abort(); viewport.disconnect(); size.disconnect();
    if (expanded) document.body.style.overflow = savedOverflow;
    dialog.remove(); controls.dispose(); resources.forEach(resource=>resource.dispose()); renderer.dispose(); renderer.forceContextLoss();
  };
}
