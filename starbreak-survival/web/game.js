(() => {
  'use strict';

  const baseWidth = 960;
  let width = baseWidth;
  const height = 540;
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  const landscape = window.matchMedia('(orientation: landscape)');
  const landscapeViewport = () => touchDevice && landscape.matches;
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const craftScale = touchDevice ? 1.24 : 1;
  const playerScale = craftScale * 1.18;
  const enemyScale = craftScale * 1.13;
  const muzzleOffset = 35 * playerScale;
  const launchCountdown = 3;
  const waveTwoAt = 14;
  const bossAt = 28;
  const bossEntryDelay = .38;
  const bossEntryEnd = 2.12;
  const bossDefeatDuration = 3.2;
  const bossBreakAt = .68;
  const bossAspect = 2 / 3;
  const bossSpriteHeight = touchDevice ? 416 : 404;
  const bossSpriteWidth = bossSpriteHeight * bossAspect;
  const bossMaskWidth = 96;
  const bossMaskHeight = 144;
  const bossScale = bossSpriteHeight / 376;
  const coreRadiusX = 21 * bossScale;
  const coreRadiusY = 28 * bossScale;
  const defenseLine = 43;
  const bossBreachX = defenseLine + 66;
  const bossDangerX = 282;
  const beamWindup = .56;
  const beamDuration = 2.5;
  const beamBossDamage = 400;
  const passiveEnergyRate = 3;
  const pickupAuraDuration = .56;
  const spreadDuration = 8;
  const overloadDuration = 12;
  const shotAngles = [[0], [0, -12, 12], [0, -7, 7, -15, 15], [-1.5, 1.5, -8, 8, -16, 16]]
    .map(volley => volley.map(degrees => degrees * Math.PI / 180));
  const bulletDamage = 12;
  const bulletSpeed = 620;
  const shotInterval = .21;
  const impactDuration = .14;
  const pulseRampTime = .24;
  const pulseRushSpeed = 418;
  const pulseWarningTime = .58;
  const effectsVolume = .64;
  const Audio = window.AudioContext ?? window.webkitAudioContext;
  // Time ranges in the PCM atlas cut from the reference recording.
  const soundClips = {
    countdown: [0, .235],
    deploy: [.26, .40],
    shot: [.68, .182],
    'bullet-hit': [.90, .125],
    'enemy-explode': [1.04, .34],
    'heavy-explode': [1.40, .52],
    pickup: [1.94, .27],
    warning: [2.35, 1.01],
    charge: [3.38, .56],
    launch: [3.96, 1.13],
    destroyed: [5.11, .82],
  };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const keys = new Set();
  const directions = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  const mediumEnemy = { speed: 190, radius: 19 };
  const mediumBlast = { duration: .40, radius: 46, sparks: 17 };
  const enemyTypes = {
    scout: { speed: 247, radius: 15 },
    striker: mediumEnemy,
    pulse: mediumEnemy,
    heavy: { speed: 143, radius: 28 },
  };
  const enemyBlasts = {
    scout: { duration: .24, radius: 30, sparks: 9 },
    striker: mediumBlast,
    pulse: mediumBlast,
    heavy: { duration: .68, radius: 75, sparks: 33 },
  };
  const enemyLoot = {
    scout: { coreChance: .54, coreValue: 8, moduleChance: .08, overloadChance: 0 },
    striker: { coreChance: .76, coreValue: 10, moduleChance: .24, overloadChance: .04 },
    pulse: { coreChance: 1, coreValue: 14, moduleChance: .55, overloadChance: .19 },
    heavy: { coreChance: 1, coreValue: 17, moduleChance: .82, overloadChance: .34 },
  };
  const bossBlasts = [
    { at: 0, dx: -51, dy: -15, radius: 116, duration: .88, sparks: 34, cue: 'heavy-explode' },
    { at: .25, dx: 22, dy: -111, radius: 80, duration: .78, sparks: 19, cue: 'enemy-explode' },
    { at: .47, dx: 7, dy: 105, radius: 106, duration: .89, sparks: 24, cue: 'enemy-explode' },
    { at: bossBreakAt, dx: -12, dy: -4, radius: 290, duration: 1.65, sparks: 78, cue: 'destroyed' },
    { at: .99, dx: 79, dy: -136, radius: 106, duration: .99, sparks: 17 },
    { at: 1.19, dx: -50, dy: 133, radius: 92, duration: .94, sparks: 14, cue: 'enemy-explode' },
    { at: 1.46, dx: 89, dy: 46, radius: 74, duration: .87, sparks: 11 },
  ];
  const artNames = ['player', 'scout', 'striker', 'heavy', 'bullet',
    'energy-core-v2', 'spread-module-v2', 'overload-module'];
  const shipSkins = [
    { id: 'cruise', name: '巡航者', rarity: '普通', rank: 0, accent: '#cbd9ea', trail: '#5ebefa', light: '#d8fbff', wash: '#6989ad45',
      description: '珍珠灰装甲下，双发引擎压着一道冰蓝航迹。', effect: '双发蓝焰 · 巡航光束' },
    { id: 'frost', name: '霜刃', rarity: '稀有', rank: 1, accent: '#9cdfff', trail: '#438dff', light: '#edffff', wash: '#1c75f17d',
      description: '钴蓝装甲与冷锻银翼，航迹碎成片片冰晶。', effect: '破冰登场 · 冷晶光束' },
    { id: 'scarlet', name: '绯曜', rarity: '典藏', rank: 2, accent: '#ffc099', trail: '#f25745', light: '#ffe6a6', wash: '#c42f377d',
      description: '绯红珐琅铸成双月翼，鎏金刻线沿刃口亮起。', effect: '赤金双月 · 熔金光束' },
    { id: 'crown', name: '曦冕', rarity: '荣耀典藏', rank: 3, accent: '#ffdd8e', trail: '#a56afa', light: '#fff2c4', wash: '#803cb578',
      description: '紫晶舰心点亮逐层展开的鎏金翼羽。', effect: '冠冕展翼 · 日冕光束' },
  ].map(skin => ({
    ...skin,
    sprite: `player-${skin.id}${skin.rank >= 2 ? '-v2' : ''}`,
    original: `player-${skin.id}`,
  }));
  const equippedSkinKey = 'starbreak-equipped-skin';
  const enemyArtWidths = { scout: 58, striker: 54, heavy: 77 };
  const baseWaves = [
    [0.8, 'striker'], [2.6, 'scout'], [4.8, 'striker'], [6.6, 'heavy'],
    [8.5, 'scout'], [9.5, 'striker'], [10.4, 'pulse'], [11.6, 'heavy'],
    [14.1, 'striker'], [14.4, 'scout'], [16.1, 'heavy'], [18.4, 'pulse'], [18.6, 'scout'],
    [20.2, 'heavy'], [22.0, 'scout'], [22.3, 'striker'], [24.1, 'heavy'],
    [25.9, 'scout'], [27.4, 'scout'], [29.2, 'striker'], [31.8, 'scout'],
    [33.4, 'heavy'], [36.4, 'pulse'], [38.2, 'scout'], [40.8, 'heavy'],
  ];
  const reinforcements = [
    [[3.9, 'pulse'], [7.8, 'scout'], [12.9, 'pulse'], [19.4, 'striker'], [26.7, 'pulse'], [43.0, 'heavy']],
    [[1.9, 'scout'], [10.1, 'pulse'], [15.4, 'pulse'], [23.5, 'pulse'], [30.9, 'heavy'], [38.8, 'pulse']],
    [[1.5, 'pulse'], [6.0, 'striker'], [11.2, 'pulse'], [17.5, 'pulse'], [24.7, 'pulse'], [35.6, 'heavy']],
    [[2.9, 'pulse'], [5.1, 'heavy'], [9.0, 'pulse'], [21.25, 'pulse'], [30.3, 'pulse'], [42.1, 'heavy']],
    [[4.35, 'pulse'], [8.9, 'heavy'], [15.1, 'pulse'], [25.1, 'pulse'], [32.7, 'pulse'], [39.6, 'heavy']],
    [[2.35, 'pulse'], [5.55, 'pulse'], [13.3, 'heavy'], [16.7, 'pulse'], [22.8, 'pulse'], [29.8, 'heavy'],
      [31.35, 'pulse'], [34.65, 'pulse'], [37.15, 'heavy'], [39.05, 'pulse'], [41.4, 'pulse'], [44, 'heavy']],
  ];
  const bossLooks = [
    { sprite: 'boss-sentinel', name: '烬环守卫', core: [.336, .459], tint: '#ff9e4e' },
    { sprite: 'boss-manta', name: '霜翼魟', core: [.285, .488], tint: '#69e8ff' },
    { sprite: 'boss-spider', name: '脉冲织蛛', core: [.303, .474], tint: '#ff5fcb' },
    { sprite: 'boss-bastion', name: '熔铸堡垒', core: [.313, .505], tint: '#ff8549' },
    { sprite: 'boss-leviathan', name: '虚空巨蛇', core: [.305, .462], tint: '#bf8bff' },
    { sprite: 'boss-eclipse', name: '蚀环引擎', core: [.291, .453], tint: '#67ffc8' },
    { sprite: 'boss-singularity', name: '奇点王座', core: [.297, .497], tint: '#ff585e' },
  ];
  const sectors = [
    { light: 1, medium: 5, heavy: 9, bossHp: 1120, speed: 1, approach: 1, patrol: 63, maxWeaponTier: 1 },
    { light: 2, medium: 6, heavy: 11, bossHp: 1360, speed: 1.03, rushDelay: 1.34, approach: 1.035, patrol: 69, maxWeaponTier: 1 },
    { light: 2, medium: 7, heavy: 13, bossHp: 1640, speed: 1.06, rushDelay: 1.22, approach: 1.07, patrol: 76, maxWeaponTier: 2 },
    { light: 3, medium: 8, heavy: 15, bossHp: 1940, speed: 1.10, rushDelay: 1.10, approach: 1.105, patrol: 83, maxWeaponTier: 2 },
    { light: 3, medium: 9, heavy: 17, bossHp: 2280, speed: 1.14, rushDelay: .98, approach: 1.14, patrol: 90, maxWeaponTier: 3 },
    { light: 4, medium: 10, heavy: 21, bossHp: 2700, speed: 1.19, rushDelay: .86, approach: 1.18, patrol: 97, coreScale: .88, weave: 11, maxWeaponTier: 3 },
    { light: 5, medium: 13, heavy: 26, bossHp: 3500, speed: 1.30, rushDelay: .65, approach: 1.24, patrol: 104, coreScale: .68, weave: 24, maxWeaponTier: 3 },
  ].map((sector, i) => ({
    coreScale: 1, weave: 0,
    ...sector,
    boss: bossLooks[i],
    waves: i === 0
      ? baseWaves.map(([at, kind]) => [at, kind === 'pulse' ? 'striker' : kind])
      : [...baseWaves, ...reinforcements.slice(0, i).flat()].sort((a, b) => a[0] - b[0]),
  }));
  const pickupTypes = {
    energy: { sprite: 'energy-core-v2', radius: 15, glow: '#ffae3b7a', edge: '#ffe6a9c2' },
    spread: { sprite: 'spread-module-v2', radius: 17, glow: '#329cfe82', edge: '#8dedffc7' },
    overload: { sprite: 'overload-module', radius: 18, glow: '#ff46c599', edge: '#ffa8f3db' },
  };

  const byId = id => document.getElementById(id);
  const canvas = byId('field');
  const ctx = canvas.getContext('2d', { alpha: !touchDevice, desynchronized: touchDevice });
  const overlay = byId('overlay');
  const flightField = canvas.closest('.flight-field');
  const flightControls = flightField.querySelector('.flight-controls');
  const startButton = byId('start');
  const hangarOpen = byId('hangar-open');
  const hangar = byId('hangar');
  const hangarClose = byId('hangar-close');
  const hangarReplay = byId('hangar-replay');
  const hangarBeam = byId('hangar-beam');
  const hangarFilmOpen = byId('hangar-film-open');
  const hangarFilmPreview = byId('hangar-film-preview');
  const crownFilm = byId('crown-film');
  const filmStatus = byId('hangar-film-status');
  const hangarPreview = byId('hangar-preview');
  const hangarCtx = hangarPreview.getContext('2d');
  const skinList = byId('skin-list');
  const skinEquip = byId('skin-equip');
  const skinStatus = byId('skin-status');
  const countdown = byId('countdown');
  const countdownNumber = byId('countdown-number');
  const pauseButton = byId('pause');
  const pauseMenu = byId('pause-menu');
  const pauseNote = byId('pause-note');
  const resumeButton = byId('resume');
  const beamButton = byId('beam');
  const soundButtons = [byId('sound'), byId('pause-sound')];
  const musicButtons = [byId('music'), byId('pause-music')];
  const musicTrack = byId('music-track');
  const fullscreenButtons = [byId('fullscreen'), byId('pause-fullscreen')];
  const fullscreenHelp = byId('fullscreen-help');
  const energy = byId('energy');
  const phase = byId('phase');
  const score = byId('score');
  const time = byId('time');
  const flightReadout = byId('flight-readout');
  const flightScore = byId('flight-score');
  const flightTime = byId('flight-time');
  const energyText = byId('energy-text');
  const bossStatus = byId('boss-status');
  const bossName = byId('boss-name');
  const bossHpLabel = byId('boss-hp-label');
  const bossHealth = byId('boss-health');
  const announcement = byId('announcement');
  const weaponStatus = byId('weapon-status');
  const weaponName = byId('weapon-name');
  const weaponTime = byId('weapon-time');

  let equippedSkin = readEquippedSkin();
  let inspectedSkin = equippedSkin;
  let hangarBurstAt = 0;
  let hangarDemo = 'arrival';
  let crownFilmSource = null;
  let crownFilmRequest = 0;
  const skinChoices = new Map();
  let game = newGame('ready');
  let drag = null;
  let dragScaleX = 1;
  let dragScaleY = 1;
  let fittedView = false;
  let fullscreenPending = false;
  let paused = false;
  let lastFrame = null;
  let visualTime = 0;
  let skyX = 0;
  let skyY = 0;
  let art = null;
  const bossMasks = new Map();
  let nebula = null;
  let audio = null;
  let soundEnabled = Boolean(Audio);
  let musicEnabled = true;
  let effectsRequest = Audio ? requestEffects() : null;

  function makeFlightRandom() {
    // Combat rolls use their own stream so particle effects cannot change the drops.
    let state = Math.floor(Math.random() * 0x100000000);
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  function arrangeWaves(schedule, random) {
    const waves = [];
    for (const [at, kind] of schedule) {
      const recent = waves.slice(-4).filter(([time]) => at - time <= 1.12);
      let lane = .5;
      let widest = -1;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = .13 + .74 * random();
        const gap = Math.min(...recent.map(([, previous]) => Math.abs(previous - candidate)));
        if (gap > widest) {
          lane = candidate;
          widest = gap;
        }
        if (gap >= .15) break;
      }
      waves.push([at, lane, kind]);
    }
    return waves;
  }

  function newGame(mode, { level = 0, score = 0, energy = 0, priorTime = 0, player, skin = equippedSkin } = {}) {
    const sector = sectors[level];
    const random = makeFlightRandom();
    return {
      mode, skin, level, sector, random, waves: arrangeWaves(sector.waves, random), priorTime,
      countdown: launchCountdown, elapsed: 0, nextWave: 0, eliteDryStreak: 0,
      score, energy, beam: 0, beamContact: null,
      shock: null, bossDefeat: null, banner: '', bannerTime: 0, hitSoundAt: 0,
      player: {
        x: player?.x ?? 155, y: player?.y ?? 270, alive: true,
        cooldown: 0, spread: player?.spread ?? 0, weaponTier: player?.weaponTier ?? 0, aura: null,
      },
      boss: null, enemies: [], bolts: [], pickups: [], particles: [], impacts: [], explosions: [],
    };
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const isFlying = () => game.mode === 'play' || game.mode === 'detonating';
  const inSortie = () => isFlying() || game.mode === 'countdown';

  async function loadArt() {
    const loadSprite = async name => {
      const sprite = new Image();
      sprite.src = `assets/starbreak-v1/${name}.webp`;
      await sprite.decode();
      return [name, sprite];
    };
    const [images, skins] = await Promise.all([
      Promise.all([...artNames, ...bossLooks.map(boss => boss.sprite)].map(loadSprite)),
      Promise.allSettled([...new Set(shipSkins.flatMap(skin => [skin.sprite, skin.original]))].map(loadSprite)),
    ]);
    const sprites = Object.fromEntries([...images, ...skins.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])]);
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = bossMaskWidth;
    maskCanvas.height = bossMaskHeight;
    const mask = maskCanvas.getContext('2d', { willReadFrequently: true });
    for (const { sprite } of bossLooks) {
      mask.clearRect(0, 0, bossMaskWidth, bossMaskHeight);
      mask.drawImage(sprites[sprite], 0, 0, bossMaskWidth, bossMaskHeight);
      bossMasks.set(sprite, mask.getImageData(0, 0, bossMaskWidth, bossMaskHeight).data);
    }
    nebula = buildNebula();
    art = sprites;
    if (touchDevice) byId('stage').style.setProperty('--sky-texture', `url("${nebula[0].toDataURL('image/webp', .82)}")`);
  }

  function readEquippedSkin() {
    try {
      const id = localStorage.getItem(equippedSkinKey);
      return shipSkins.find(skin => skin.id === id) || shipSkins[0];
    } catch {
      return shipSkins[0];
    }
  }

  const skinSprite = skin => art[skin.sprite] ? skin.sprite : art[skin.original] ? skin.original : 'player';

  function showSkin(skin) {
    inspectedSkin = skin;
    hangar.style.setProperty('--skin-accent', skin.accent);
    hangar.style.setProperty('--hangar-wash', skin.wash);
    byId('skin-name').textContent = skin.name;
    byId('skin-rarity').textContent = skin.rarity;
    byId('skin-description').textContent = skin.description;
    byId('skin-effect').textContent = skin.effect;
    hangarFilmOpen.hidden = skin.id !== 'crown';
    hangarReplay.hidden = !hangarFilmOpen.hidden;
    for (const [candidate, { button, badge }] of skinChoices) {
      button.setAttribute('aria-pressed', String(candidate === skin));
      badge.hidden = candidate !== equippedSkin;
    }
    skinEquip.disabled = skin === equippedSkin;
    skinEquip.textContent = skin === equippedSkin ? '已装备' : `装备${skin.name}`;
  }

  function previewHangar(demo) {
    const showingFilm = demo === 'film';
    if (!showingFilm) {
      if (hangarDemo === 'film') crownFilm.pause();
      hangarFilmPreview.hidden = true;
      hangarPreview.hidden = false;
      setFilmStatus('');
    }
    hangarDemo = demo;
    hangarBurstAt = visualTime;
    hangarFilmOpen.setAttribute('aria-pressed', String(showingFilm));
    hangarReplay.setAttribute('aria-pressed', String(demo === 'arrival'));
    hangarBeam.setAttribute('aria-pressed', String(demo === 'beam'));
    if (hangar.open && !showingFilm) paintHangar();
  }

  function setFilmStatus(message) {
    filmStatus.textContent = message;
    filmStatus.hidden = !message;
  }

  function failCrownDemo() {
    if (!hangar.open || hangarDemo !== 'film') return;
    previewHangar('display');
    setFilmStatus('暂时无法载入演示，请点「登场」重试。');
  }

  async function playCrownFilm() {
    const request = ++crownFilmRequest;
    const isCurrent = () => request === crownFilmRequest && hangar.open && hangarDemo === 'film';
    const url = touchDevice ? crownFilm.dataset.mobileSrc : crownFilm.dataset.src;
    const play = async () => {
      try {
        await crownFilm.play();
      } catch (error) {
        if (error.name !== 'NotAllowedError') throw error;
        if (!isCurrent()) return;
        crownFilm.muted = true;
        await crownFilm.play();
      }
    };
    crownFilm.muted = !soundEnabled;
    previewHangar('film');
    if (!crownFilm.hasAttribute('src') || crownFilm.error) crownFilm.src = url;
    if (crownFilm.readyState >= 1) crownFilm.currentTime = 0;
    setFilmStatus('载入演示…');
    try {
      await play();
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError') return;
      if (!crownFilm.error || crownFilm.src.startsWith('blob:')) {
        failCrownDemo();
        return;
      }
      // Some servers don't serve the byte ranges Safari needs for video.
      crownFilmSource ??= fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Video unavailable');
          return response.blob();
        })
        .then(blob => URL.createObjectURL(blob))
        .catch(fetchError => {
          crownFilmSource = null;
          throw fetchError;
        });
      try {
        const source = await crownFilmSource;
        if (!isCurrent()) return;
        crownFilm.src = source;
        await play();
      } catch (fallbackError) {
        if (isCurrent() && fallbackError.name !== 'AbortError') failCrownDemo();
      }
    }
  }

  function previewSelectedSkin() {
    if (inspectedSkin.id === 'crown') playCrownFilm();
    else previewHangar('arrival');
  }

  function initHangar() {
    if (skinSprite(equippedSkin) === 'player') equippedSkin = shipSkins[0];
    for (const skin of shipSkins) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin-choice';
      button.dataset.skin = skin.id;
      button.style.setProperty('--item-accent', skin.accent);
      button.style.setProperty('--item-wash', skin.wash);
      button.disabled = skin.rank > 0 && skinSprite(skin) === 'player';
      const thumb = document.createElement('img');
      thumb.alt = '';
      if (!button.disabled) thumb.src = art[skinSprite(skin)].src;
      const label = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = skin.name;
      const rarity = document.createElement('small');
      rarity.textContent = button.disabled ? `${skin.rarity} · 素材未加载` : skin.rarity;
      label.append(name, rarity);
      const badge = document.createElement('small');
      badge.className = 'skin-equipped';
      badge.textContent = '已装备';
      button.append(thumb, label, badge);
      skinList.append(button);
      skinChoices.set(skin, { button, badge });
      button.addEventListener('click', () => {
        showSkin(skin);
        previewSelectedSkin();
      });
    }
    hangarOpen.disabled = false;
    hangarOpen.addEventListener('click', () => {
      if (overlay.hidden || hangar.open) return;
      clearInput();
      skinStatus.textContent = `已装备 ${equippedSkin.name} · 全部战机数值一致`;
      const featured = shipSkins[3];
      const skin = skinSprite(featured) === 'player' ? equippedSkin : featured;
      showSkin(skin);
      hangar.showModal();
      previewSelectedSkin();
    });
    hangarClose.addEventListener('click', () => hangar.close());
    hangar.addEventListener('close', () => {
      if (hangar.open) return;
      previewHangar('display');
      hangarOpen.focus({ preventScroll: true });
    });
    hangarReplay.addEventListener('click', () => previewHangar('arrival'));
    hangarBeam.addEventListener('click', () => previewHangar('beam'));
    hangarFilmOpen.addEventListener('click', playCrownFilm);
    crownFilm.addEventListener('playing', () => {
      if (!hangar.open || hangarDemo !== 'film') return;
      hangarFilmPreview.hidden = false;
      hangarPreview.hidden = true;
      setFilmStatus('');
    });
    crownFilm.addEventListener('ended', () => {
      if (hangarDemo === 'film') previewHangar('display');
    });
    crownFilm.addEventListener('error', () => {
      if (!hangarFilmPreview.hidden) failCrownDemo();
    });
    skinEquip.addEventListener('click', () => {
      equippedSkin = inspectedSkin;
      let saved = true;
      try {
        localStorage.setItem(equippedSkinKey, equippedSkin.id);
      } catch {
        saved = false;
      }
      showSkin(equippedSkin);
      skinChoices.get(equippedSkin).button.focus({ preventScroll: true });
      skinStatus.textContent = `已装备 ${equippedSkin.name} · ${saved ? '全部战机数值一致' : '本次页面有效'}`;
    });
  }

  function requestEffects() {
    return fetch('assets/audio-recording/effects.wav?v=2')
      .then(response => response.ok ? response.arrayBuffer() : null)
      .catch(() => null);
  }

  function unlockSound() {
    if (!soundEnabled || paused || document.hidden) return;
    if (!audio) {
      let context;
      try {
        context = new Audio();
      } catch {
        return;
      }
      const output = context.createGain();
      output.gain.value = effectsVolume;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -17;
      limiter.knee.value = 20;
      limiter.ratio.value = 3.5;
      limiter.attack.value = .006;
      limiter.release.value = .17;
      output.connect(limiter);
      limiter.connect(context.destination);
      audio = { context, output, buffer: null, loading: null };
    }
    const resumed = audio.context.state === 'running' ? Promise.resolve() : audio.context.resume().catch(() => {});
    if (!audio.buffer && !audio.loading) {
      effectsRequest ??= requestEffects();
      audio.loading = effectsRequest.then(bytes => {
        if (bytes) return audio.context.decodeAudioData(bytes);
      }).then(buffer => {
        if (buffer) audio.buffer = buffer;
      }).catch(() => {}).finally(() => {
        effectsRequest = null;
        audio.loading = null;
      });
    }
    return audio.loading ? Promise.all([resumed, audio.loading]) : resumed;
  }

  function updateSoundButton() {
    for (const button of soundButtons) {
      button.setAttribute('aria-pressed', String(soundEnabled));
      button.querySelector('span').textContent = soundEnabled ? '音效开' : '音效关';
    }
  }

  function syncMusic() {
    const detonating = game.mode === 'detonating';
    const arriving = game.mode === 'play' && game.boss?.age < bossEntryEnd;
    const preparing = game.mode === 'countdown';
    musicTrack.volume = detonating ? .38 : game.beam > 0 ? .36 : arriving || preparing ? .54 : .73;
    if (musicEnabled && !paused && (game.mode === 'play' || preparing || detonating) && !document.hidden) {
      if (musicTrack.paused) musicTrack.play().catch(() => {});
    } else if (!musicTrack.paused) {
      musicTrack.pause();
    }
  }

  function playSound(cue, level = 1) {
    if (paused || document.hidden || !soundEnabled || !audio?.buffer || audio.context.state !== 'running') return;
    const [offset, duration] = soundClips[cue];
    const source = audio.context.createBufferSource();
    source.buffer = audio.buffer;
    if (level === 1) {
      source.connect(audio.output);
    } else {
      const gain = audio.context.createGain();
      gain.gain.value = level;
      source.connect(gain);
      gain.connect(audio.output);
    }
    source.start(audio.context.currentTime + .008, offset, duration);
  }

  function movePlayer(x, y) {
    const edge = 44 * playerScale;
    game.player.x = clamp(x, edge, Math.min(555, width - edge));
    game.player.y = clamp(y, 36 * playerScale, height - 36 * playerScale);
  }

  function start() {
    if (!art || hangar.open || fullscreenHelp.open || inSortie()) return;
    const flight = newGame('countdown');
    game = flight;
    paused = false;
    unlockSound()?.then(() => {
      if (game === flight && game.mode === 'countdown' && game.countdown > launchCountdown - 1) playSound('countdown');
    });
    syncMusic();
    clearInput();
    overlay.classList.remove('is-home');
    overlay.hidden = true;
    if (touchDevice) document.documentElement.classList.add('sortie-active');
    resize();
    lastFrame = null;
    canvas.focus({ preventScroll: true });
    updateHud();
    if (touchDevice && !landscape.matches) orientForFlight();
  }

  function setPaused(value, note = '') {
    if (!inSortie() || paused === value) return;
    paused = value;
    clearInput();
    pauseMenu.hidden = !paused;
    pauseNote.textContent = note;
    pauseNote.hidden = !note;
    if (paused) {
      audio?.context.suspend().catch(() => {});
      if (!document.hidden && document.hasFocus()) resumeButton.focus({ preventScroll: true });
    } else {
      unlockSound();
      canvas.focus({ preventScroll: true });
    }
    lastFrame = null;
    syncMusic();
    updateHud();
  }

  function togglePause() {
    setPaused(!paused);
  }

  function interruptFlight(note = '战局已保留。') {
    lastFrame = null;
    if (hangarDemo === 'film') previewHangar('display');
    if (inSortie() && !paused) setPaused(true, note);
    else clearInput();
  }

  function finish(won, breach = false) {
    game.mode = won ? 'win' : 'loss';
    game.beam = 0;
    game.beamContact = null;
    syncMusic();
    clearInput();
    document.documentElement.classList.remove('sortie-active');
    byId('brief-tag').textContent = won ? '任务完成' : '信号中断';
    byId('brief-title').textContent = won ? '突围成功' : breach ? '防线失守' : '战机坠毁';
    byId('brief-text').textContent = `得分 ${game.score} · 飞行 ${Math.floor(game.priorTime + game.elapsed)} 秒`;
    startButton.firstChild.textContent = '重新出击 ';
    overlay.hidden = false;
    startButton.focus({ preventScroll: true });
  }

  function showBanner(message, duration) {
    game.banner = message;
    game.bannerTime = duration;
  }

  function gainEnergy(amount) {
    game.energy = Math.min(100, game.energy + amount);
  }

  function fireBeam() {
    if (paused || game.mode !== 'play' || game.energy < 100 || game.beam > 0) return;
    unlockSound();
    game.energy = 0;
    game.beam = beamWindup + beamDuration;
    showBanner('全域光束', .9);
    syncMusic();
    playSound('charge');
    if (touchDevice) navigator.vibrate?.(22);
    updateHud();
  }

  function resetDrag() {
    const id = drag?.id;
    drag = null;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  function clearInput() {
    keys.clear();
    resetDrag();
  }

  function nativeFullscreen() {
    return document.fullscreenElement ?? document.webkitFullscreenElement;
  }

  function fullscreenRequest() {
    const root = document.documentElement;
    if (document.fullscreenEnabled && root.requestFullscreen) return () => root.requestFullscreen({ navigationUI: 'hide' });
    if (document.webkitFullscreenEnabled && root.webkitRequestFullscreen) return () => root.webkitRequestFullscreen();
    return null;
  }

  function updateFullscreen() {
    const native = Boolean(nativeFullscreen());
    if (native) fittedView = false;
    const fitted = fittedView && !landscapeViewport();
    const active = native || fitted;
    const guide = !native && landscapeViewport() && !fullscreenRequest();
    if (document.documentElement.classList.contains('full-view') !== active) clearInput();
    document.documentElement.classList.toggle('full-view', active);
    for (const button of fullscreenButtons) {
      button.hidden = touchDevice && standalone && !native;
      if (guide) {
        button.removeAttribute('aria-pressed');
        button.setAttribute('aria-haspopup', 'dialog');
      } else {
        button.setAttribute('aria-pressed', String(active));
        button.removeAttribute('aria-haspopup');
      }
      button.setAttribute('aria-label', guide ? '查看全屏方式' : native ? '退出全屏' : fitted ? '退出沉浸显示' : '进入全屏');
      button.querySelector('span').textContent = guide ? '全屏方式' : fitted ? '退出沉浸' : native ? '退出全屏' : '全屏';
    }
    resize();
  }

  async function toggleFullscreen() {
    if (fullscreenPending) return;
    if (nativeFullscreen()) {
      const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
      try {
        await exit?.call(document);
      } catch {
        // Keep the current state if the browser refuses to exit.
      } finally {
        updateFullscreen();
      }
      return;
    }
    if (landscapeViewport()) {
      await enterNativeFullscreen();
      if (nativeFullscreen()) await lockLandscape();
      else if (!fullscreenHelp.open && (!inSortie() || paused)) fullscreenHelp.showModal();
      return;
    }
    if (fittedView) {
      fittedView = false;
      updateFullscreen();
      return;
    }
    // Apply the viewport layout immediately, including when WebKit returns without entering fullscreen.
    fittedView = true;
    updateFullscreen();
    await enterNativeFullscreen();
    if (touchDevice && nativeFullscreen()) await lockLandscape();
  }

  async function enterNativeFullscreen() {
    if (fullscreenPending) return;
    const request = fullscreenRequest();
    if (!request) return;
    fullscreenPending = true;
    try {
      const result = request();
      // Older WebKit reports the result through fullscreenchange instead of a promise.
      if (result === undefined) await new Promise(resolve => setTimeout(resolve, 180));
      else await result;
      updateFullscreen();
    } catch {
      // The browser can deny fullscreen even after a tap.
    } finally {
      fullscreenPending = false;
    }
  }

  async function lockLandscape() {
    try {
      await screen.orientation?.lock?.('landscape');
    } catch {
      // The portrait layout stays playable if orientation lock is denied.
    }
  }

  async function orientForFlight() {
    if (!screen.orientation?.lock) return;
    if (!nativeFullscreen() && !standalone) await enterNativeFullscreen();
    if (inSortie()) await lockLandscape();
  }
  for (const button of fullscreenButtons) button.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreen);
  document.addEventListener('webkitfullscreenchange', updateFullscreen);

  window.addEventListener('keydown', event => {
    const { code } = event;
    if (hangar.open || fullscreenHelp.open) return;
    if (code === 'Escape' && fittedView) {
      fittedView = false;
      updateFullscreen();
      return;
    }
    if (code === 'KeyP' && !event.repeat && inSortie()) {
      event.preventDefault();
      togglePause();
      return;
    }
    if ((soundButtons.includes(event.target) || musicButtons.includes(event.target) || fullscreenButtons.includes(event.target) ||
      event.target === pauseButton || event.target === resumeButton || event.target === hangarOpen)
      && (code === 'Space' || code === 'Enter')) return;
    if (paused) return;
    if (inSortie() && (directions.includes(code) || code === 'Space')) {
      event.preventDefault();
      if (code === 'Space') {
        if (!event.repeat) fireBeam();
      } else {
        keys.add(code);
      }
    } else if (!inSortie() && !event.repeat && (code === 'Enter' || code === 'KeyR')) {
      event.preventDefault();
      start();
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => interruptFlight());
  document.addEventListener('visibilitychange', () => {
    lastFrame = null;
    if (document.hidden) interruptFlight();
    syncMusic();
  });
  window.addEventListener('pagehide', () => interruptFlight());
  if (touchDevice) {
    landscape.addEventListener('change', () => {
      updateFullscreen();
      if (landscape.matches && game.mode === 'countdown' && !paused) {
        clearInput();
        lastFrame = null;
        return;
      }
      interruptFlight('屏幕方向已切换，战局已保留。');
    });
    for (const type of ['gesturestart', 'gesturechange']) {
      document.addEventListener(type, event => event.preventDefault(), { passive: false });
    }
    flightField.addEventListener('contextmenu', event => {
      if (inSortie()) event.preventDefault();
    });
  }
  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', togglePause);
  resumeButton.addEventListener('click', togglePause);
  updateSoundButton();
  function toggleSound() {
    soundEnabled = !soundEnabled;
    updateSoundButton();
    if (soundEnabled) unlockSound();
    if (audio) audio.output.gain.setTargetAtTime(soundEnabled ? effectsVolume : 0, audio.context.currentTime, .02);
  }
  for (const button of soundButtons) {
    button.disabled = !Audio;
    button.addEventListener('click', toggleSound);
  }
  function toggleMusic() {
    musicEnabled = !musicEnabled;
    for (const button of musicButtons) {
      button.setAttribute('aria-pressed', String(musicEnabled));
      button.querySelector('span').textContent = musicEnabled ? '音乐开' : '音乐关';
    }
    syncMusic();
  }
  for (const button of musicButtons) button.addEventListener('click', toggleMusic);
  beamButton.addEventListener('click', fireBeam);
  window.addEventListener('pointerup', unlockSound);
  beamButton.addEventListener('pointerdown', event => {
    if ((event.pointerType === 'touch' || event.pointerType === 'pen') && !beamButton.disabled) {
      event.preventDefault();
      fireBeam();
    }
  });

  canvas.addEventListener('pointerdown', event => {
    if (paused || !inSortie() || drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.preventDefault();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners can still follow the pointer while it stays on the page.
    }
  });
  window.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    if (isFlying()) {
      movePlayer(
        game.player.x + (event.clientX - drag.x) * dragScaleX,
        game.player.y + (event.clientY - drag.y) * dragScaleY,
      );
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  function releaseMovement(event) {
    if (drag?.id === event.pointerId) resetDrag();
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    window.addEventListener(type, releaseMovement);
  }

  function spawnEnemy(lane, kind) {
    const type = enemyTypes[kind];
    const { sector } = game;
    const hits = kind === 'scout' ? sector.light : kind === 'heavy' ? sector.heavy : sector.medium;
    const enemy = {
      x: width + 46, y: lane * height, kind, hit: 0,
      hp: hits * bulletDamage, speed: type.speed * sector.speed, radius: type.radius * craftScale,
    };
    if (kind === 'pulse') enemy.chargeAge = 0;
    game.enemies.push(enemy);
  }

  function spawnBoss() {
    const hp = game.sector.bossHp;
    const entryStart = width + 170;
    game.boss = { x: entryStart, entryStart, entryStop: width - 161, y: 270, hp, maxHp: hp, age: 0, hit: 0 };
    showBanner(`警报 · ${game.sector.boss.name}`, bossEntryEnd);
    syncMusic();
    playSound('warning');
  }

  function bossCoreAt(x, y, spriteHeight = bossSpriteHeight) {
    const [u, v] = game.sector.boss.core;
    return { x: x + (u - .5) * spriteHeight * bossAspect, y: y + (v - .5) * spriteHeight };
  }

  function bossHullAt(boss, x, y) {
    const column = Math.floor(((x - boss.x) / bossSpriteWidth + .5) * bossMaskWidth);
    const row = Math.floor(((y - boss.y) / bossSpriteHeight + .5) * bossMaskHeight);
    if (column < 0 || column >= bossMaskWidth || row < 0 || row >= bossMaskHeight) return false;
    return bossMasks.get(game.sector.boss.sprite)[(row * bossMaskWidth + column) * 4 + 3] >= 190;
  }

  function burst(x, y, color, count, speed, lifeScale = 1, debris = false) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (.25 + Math.random() * .75);
      const life = (.2 + Math.random() * .55) * lifeScale;
      game.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life, maxLife: life, color, size: 1 + Math.random() * 4, debris });
    }
  }

  function bulletImpact(target, bolt, color) {
    if (target) target.hit = .12;
    const x = bolt.x + 5;
    game.impacts.push({ x, y: bolt.y, color, life: impactDuration });
    burst(x, bolt.y, color, bolt.angle === 0 ? 6 : 3, 138);
    if (game.elapsed >= game.hitSoundAt) {
      playSound('bullet-hit', target ? .82 : 1);
      game.hitSoundAt = game.elapsed + .09;
    }
  }

  function shockwave(x, y) {
    if (!game.shock) playSound('heavy-explode', .42);
    game.shock = { x, y, duration: .35, remaining: .35 };
    burst(x, y, '#b3fff4', 24, 290);
    burst(x, y, '#ffe2aa', 12, 190);
  }

  function beginBossDefeat(boss) {
    game.bossDefeat = { x: boss.x, y: boss.y, age: 0, nextBlast: 0 };
    game.mode = 'detonating';
    game.score += 1500;
    game.boss = game.shock = null;
    if (game.beam > beamDuration) game.beam = 0;
    game.enemies = [];
    game.bolts = [];
    game.pickups = [];
    syncMusic();
    updateBossDefeat(0);
  }

  function updateBossDefeat(dt) {
    const defeat = game.bossDefeat;
    defeat.age += dt;
    while (bossBlasts[defeat.nextBlast]?.at <= defeat.age) {
      const blast = bossBlasts[defeat.nextBlast++];
      const main = blast.at === bossBreakAt;
      const x = defeat.x + blast.dx * bossScale;
      const y = defeat.y + blast.dy * bossScale;
      if (blast.cue) playSound(blast.cue, main ? 1 : .58);
      const count = motion.matches ? Math.ceil(blast.sparks / 3) : blast.sparks;
      burst(x, y, '#ff994f', count, main ? 380 : 190, main ? 2.9 : 1.6, true);
      burst(x, y, '#fff4cb', Math.ceil(count * .57), main ? 470 : 235, main ? 2.1 : 1.2, true);
      if (main) {
        burst(x, y, '#e58ebf', motion.matches ? 8 : 28, 172, 3.2, true);
        burst(x, y, '#ffc27c', motion.matches ? 7 : 22, 92, 3.5, true);
      }
    }
    if (defeat.age >= bossDefeatDuration) {
      game.bossDefeat = null;
      const { level, score, energy, priorTime, elapsed, player, skin } = game;
      if (level === sectors.length - 1) {
        finish(true);
      } else {
        game = newGame('play', { level: level + 1, score, energy: Math.max(35, energy), priorTime: priorTime + elapsed, player, skin });
        syncMusic();
      }
    }
  }

  function hitPlayer() {
    const player = game.player;
    if (!player.alive) return;
    player.alive = false;
    burst(player.x, player.y, '#ffd29c', 48, 230);
  }

  function explodeEnemy(enemy, loot) {
    const heavy = enemy.kind === 'heavy';
    if (loot) {
      game.score += heavy ? 180 : 100;
      gainEnergy(heavy ? 23 : 17);
    }
    const { duration, radius, sparks } = enemyBlasts[enemy.kind];
    game.explosions.push({ x: enemy.x, y: enemy.y, kind: enemy.kind, life: duration, loot });
    const count = motion.matches ? Math.ceil(sparks / 3) : sparks;
    burst(enemy.x, enemy.y, '#ffad57', count, radius / duration * 2.05, duration / .66, true);
    burst(enemy.x, enemy.y, '#fff2bd', Math.ceil(count * .47), radius / duration * 1.66, duration / .78, true);
    if (heavy) burst(enemy.x, enemy.y, '#cf6337', motion.matches ? 3 : 10, 122, duration / .65, true);
  }

  function updateExplosions(dt) {
    game.explosions = game.explosions.filter(explosion => {
      explosion.life -= dt;
      if (explosion.life > 0) return true;
      if (game.mode === 'play' && explosion.loot) dropEnemyLoot(explosion);
      return false;
    });
  }

  function dropEnemyLoot(explosion) {
    const { kind } = explosion;
    const loot = enemyLoot[kind];
    const x = clamp(explosion.x, 25, width - 25);
    const y = clamp(explosion.y, 25, height - 25);
    const core = game.random() < loot.coreChance;
    if (core) game.pickups.push({ x, y, age: 0, kind: 'energy', value: loot.coreValue });

    const elite = kind === 'pulse' || kind === 'heavy';
    const roll = game.random();
    const module = roll < loot.moduleChance || (elite && game.eliteDryStreak >= 2);
    if (elite) game.eliteDryStreak = module ? 0 : game.eliteDryStreak + 1;
    if (!module) return;

    const overload = game.level >= 2 && roll < loot.overloadChance;
    const offset = core ? (y < height / 2 ? 40 : -40) : 0;
    game.pickups.push({ x, y: y + offset, age: 0, kind: overload ? 'overload' : 'spread' });
  }

  function updatePlayer(dt) {
    const player = game.player;
    const dx = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
    const dy = Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW'));
    if (dx || dy) {
      const stride = 320 * dt / Math.max(1, Math.hypot(dx, dy));
      movePlayer(player.x + dx * stride, player.y + dy * stride);
    }
    player.spread = Math.max(0, player.spread - dt);
    if (!player.spread) player.weaponTier = 0;
    if (player.aura) {
      player.aura.age += dt;
      if (player.aura.age >= pickupAuraDuration) player.aura = null;
    }
    if (game.mode !== 'play') return;
    player.cooldown -= dt;
    if (player.cooldown <= 0) {
      for (const angle of shotAngles[player.weaponTier]) {
        game.bolts.push({ x: player.x + muzzleOffset, y: player.y, angle });
      }
      playSound('shot', .26);
      player.cooldown += shotInterval;
    }
  }

  function pulseDrive(age) {
    return clamp((age - game.sector.rushDelay) / pulseRampTime, 0, 1);
  }

  function updateEnemies(dt) {
    const { sector } = game;
    for (const enemy of game.enemies) {
      let speed = enemy.speed;
      if (enemy.kind === 'pulse' && enemy.x <= width) {
        enemy.chargeAge += dt;
        speed += (pulseRushSpeed * sector.speed - speed) * pulseDrive(enemy.chargeAge);
      }
      enemy.x -= speed * dt;
      enemy.hit = Math.max(0, enemy.hit - dt);
    }
    const boss = game.boss;
    if (!boss) return;
    const previousX = boss.x;
    const previousAge = boss.age;
    boss.age += dt;
    if (previousAge < bossEntryEnd && boss.age >= bossEntryEnd) syncMusic();
    const entry = clamp((boss.age - bossEntryDelay) / (bossEntryEnd - bossEntryDelay), 0, 1);
    const approach = Math.max(0, boss.age - bossEntryEnd);
    boss.x = boss.entryStop + (boss.entryStart - boss.entryStop) * (1 - entry) ** 2.4 -
      sector.approach * (24 * approach + .38 * approach ** 2);
    if (previousX >= bossDangerX && boss.x < bossDangerX) {
      showBanner('危险 · 守卫逼近防线', 1.8);
      playSound('warning');
    }
    const patrol = Math.max(0, boss.age - bossEntryDelay);
    const swing = sector.patrol * Math.sin(patrol * .86 * sector.speed) + sector.weave * Math.sin(patrol * 2.63);
    boss.y = height / 2 + swing * clamp(patrol / 1.1, 0, 1);
    boss.hit = Math.max(0, boss.hit - dt);
  }

  function onField(x, y, halfWidth, halfHeight) {
    return x + halfWidth >= 0 && x - halfWidth <= width &&
      y + halfHeight >= 0 && y - halfHeight <= height;
  }

  function releaseBeam() {
    const { player } = game;
    burst(player.x + muzzleOffset, player.y, '#bafaff', motion.matches ? 8 : 28, 248);
    playSound('launch');
  }

  function applyBeamDamage() {
    const { boss } = game;
    for (const enemy of game.enemies) {
      const artWidth = enemyArtWidths[enemy.kind === 'pulse' ? 'striker' : enemy.kind];
      if (onField(enemy.x, enemy.y, artWidth * enemyScale / 2, enemy.radius * 1.13)) enemy.hp = 0;
    }
    if (boss && !game.beamContact && onField(boss.x, boss.y, bossSpriteWidth / 2, bossSpriteHeight / 2)) {
      const core = bossCoreAt(boss.x, boss.y);
      boss.hp = Math.max(0, boss.hp - beamBossDamage);
      boss.hit = .24;
      game.beamContact = core;
      shockwave(core.x, core.y);
    }
  }

  function updateAttacks(dt) {
    const { player, boss } = game;
    const core = boss ? bossCoreAt(boss.x, boss.y) : null;
    const coreWidth = coreRadiusX * game.sector.coreScale;
    const coreHeight = coreRadiusY * game.sector.coreScale;
    const previousBeam = game.beam;
    game.beam = Math.max(0, game.beam - dt);
    if (previousBeam > 0 && game.beam === 0) {
      game.beamContact = null;
      syncMusic();
    }
    if (previousBeam > beamDuration && game.beam <= beamDuration) releaseBeam();
    if (game.beam > 0 && game.beam <= beamDuration) applyBeamDamage();
    if (game.beamContact && core) game.beamContact = core;

    game.bolts = game.bolts.filter(bolt => {
      bolt.x += Math.cos(bolt.angle) * bulletSpeed * dt;
      bolt.y += Math.sin(bolt.angle) * bulletSpeed * dt;
      const damage = bolt.angle === 0 ? bulletDamage : bulletDamage / 2;
      const enemy = game.enemies.find(target => target.hp > 0 && Math.hypot(target.x - bolt.x, target.y - bolt.y) < target.radius + 6);
      if (enemy) {
        enemy.hp -= damage;
        const sparks = enemy.kind === 'pulse' ? '#ff96bc' : enemy.kind === 'striker' ? '#ffbc76' : '#adf9ff';
        bulletImpact(enemy, bolt, sparks);
        return false;
      }
      if (core && boss.hp > 0) {
        const coreOffset = bolt.y - core.y;
        if (Math.hypot((bolt.x - core.x) / (coreWidth + 3), coreOffset / (coreHeight + 2)) <= 1) {
          boss.hp -= damage;
          gainEnergy(1);
          bulletImpact(boss, bolt, '#ffd8ac');
          return false;
        }
        const enteringCore = bolt.x < core.x && Math.abs(coreOffset) < coreHeight + 2;
        if (!enteringCore && bossHullAt(boss, bolt.x, bolt.y)) {
          bulletImpact(null, bolt, '#adc9fb');
          return false;
        }
      }
      return bolt.x < width + 20 && bolt.y > -20 && bolt.y < height + 20;
    });

    let explosionCue = null;
    game.enemies = game.enemies.filter(enemy => {
      const destroyed = enemy.hp <= 0;
      const collided = !destroyed && Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + 11 * craftScale;
      if (destroyed || collided) {
        if (collided) hitPlayer();
        explodeEnemy(enemy, destroyed);
        if (enemy.kind === 'heavy') explosionCue = 'heavy-explode';
        else if (!explosionCue) explosionCue = 'enemy-explode';
        return false;
      }
      return enemy.x > -60;
    });
    if (explosionCue) playSound(explosionCue);

    if (!player.alive) {
      finish(false);
    } else if (boss && boss.hp <= 0) {
      beginBossDefeat(boss);
    } else {
      const hull = 11 * craftScale;
      if (boss && [[0, 0], [hull, 0], [-hull, 0], [0, hull], [0, -hull]]
        .some(([dx, dy]) => bossHullAt(boss, player.x + dx, player.y + dy))) hitPlayer();
      if (!player.alive) finish(false);
      else if (boss && boss.x <= bossBreachX) finish(false, true);
    }
  }

  function updatePickups(dt) {
    const player = game.player;
    game.pickups = game.pickups.filter(pickup => {
      pickup.age += dt;
      pickup.x -= 115 * dt;
      const radius = pickupTypes[pickup.kind].radius * craftScale;
      const dx = pickup.x - (player.x - 5 * playerScale);
      const dy = pickup.y - player.y;
      const touching = Math.hypot(dx / (35 * playerScale + radius), dy / (17 * playerScale + radius)) <= 1;
      if (touching) {
        playSound('pickup');
        if (pickup.kind === 'energy') {
          gainEnergy(pickup.value);
          player.aura = { age: 0, label: `光束能量 +${pickup.value}` };
        } else {
          const overload = pickup.kind === 'overload';
          player.weaponTier = Math.min(game.sector.maxWeaponTier, player.weaponTier + (overload ? 2 : 1));
          player.spread = Math.max(player.spread, overload ? overloadDuration : spreadDuration);
          if (overload) gainEnergy(35);
          const lanes = shotAngles[player.weaponTier].length;
          player.aura = { age: 0, label: overload ? `超载 · ${lanes} 路射击` : `${lanes} 路射击` };
        }
        return false;
      }
      return pickup.x > -20 && pickup.age < 9;
    });
  }

  function step(dt) {
    if (game.mode === 'countdown') {
      const previous = Math.ceil(game.countdown - 1e-7);
      game.countdown = Math.max(0, game.countdown - dt);
      const remaining = Math.ceil(game.countdown - 1e-7);
      if (remaining <= 0) {
        game.mode = 'play';
        showBanner('出击', .72);
        playSound('deploy');
        syncMusic();
      } else if (remaining < previous) playSound('countdown');
      return;
    }
    if (game.mode === 'play') {
      const before = game.elapsed;
      game.elapsed += dt;
      gainEnergy(passiveEnergyRate * dt);
      game.bannerTime -= dt;
      if (before < waveTwoAt && game.elapsed >= waveTwoAt) showBanner('拦截编队接近', 1.5);
      if (before < bossAt && game.elapsed >= bossAt) spawnBoss();
      const { waves } = game;
      while (game.nextWave < waves.length && waves[game.nextWave][0] <= game.elapsed) {
        const [, lane, kind] = waves[game.nextWave++];
        spawnEnemy(lane, kind);
      }
      updatePlayer(dt);
      updateEnemies(dt);
      updateAttacks(dt);
      if (game.mode === 'play') updatePickups(dt);
    } else if (game.mode === 'detonating') {
      game.elapsed += dt;
      game.beam = Math.max(0, game.beam - dt);
      updatePlayer(dt);
      updateBossDefeat(dt);
    }
    if (game.shock) {
      game.shock.remaining -= dt;
      if (game.shock.remaining <= 0) game.shock = null;
    }
    updateExplosions(dt);
    game.impacts = game.impacts.filter(impact => {
      impact.life -= dt;
      return impact.life > 0;
    });
    game.particles = game.particles.filter(particle => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      return particle.life > 0;
    });
  }

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function updateHud() {
    const state = { ready: '待命', countdown: '准备出击', detonating: '目标解体', win: '任务完成', loss: '任务中断' };
    setText(phase, paused ? '暂停' : state[game.mode] ?? (game.boss ? 'Boss 战' : '飞行中'));
    const scoreText = String(game.score).padStart(5, '0');
    const seconds = Math.floor(game.priorTime + game.elapsed);
    const timeText = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    setText(score, scoreText);
    setText(time, timeText);
    flightReadout.hidden = !inSortie();
    setText(flightScore, scoreText);
    setText(flightTime, timeText);
    flightControls.hidden = !isFlying();
    const charge = Math.floor(game.energy);
    setText(energyText, `${charge}%`);
    if (energy.value !== charge) {
      energy.value = charge;
      beamButton.style.setProperty('--charge-angle', `${charge * 3.6}deg`);
    }
    pauseButton.hidden = !inSortie() || paused;
    countdown.hidden = paused || game.mode !== 'countdown';
    if (!countdown.hidden) {
      setText(countdownNumber, String(Math.max(1, Math.ceil(game.countdown - 1e-7))));
    }
    beamButton.disabled = paused || game.mode !== 'play' || game.energy < 100 || game.beam > 0;
    bossStatus.hidden = paused || game.mode !== 'play' || !game.boss || game.boss.age < .52;
    if (game.boss) {
      setText(bossName, game.sector.boss.name);
      const hp = Math.max(0, game.boss.hp);
      bossHealth.value = hp / game.boss.maxHp;
      setText(bossHpLabel, `${hp}/${game.boss.maxHp}`);
    }
    weaponStatus.hidden = paused || game.mode !== 'play' || game.player.weaponTier === 0;
    if (!weaponStatus.hidden) {
      setText(weaponName, `${shotAngles[game.player.weaponTier].length} 路射击`);
      setText(weaponTime, `${Math.ceil(game.player.spread)} 秒`);
    }
    const ultimateCue = game.beam > beamDuration - .28;
    announcement.hidden = paused || game.mode !== 'play' || (game.bannerTime <= 0 && !ultimateCue);
    announcement.classList.toggle('boss-alert', Boolean(game.boss) && !ultimateCue && game.banner !== '全域光束');
    announcement.classList.toggle('ultimate-alert', ultimateCue || game.banner === '全域光束');
    setText(announcement, ultimateCue ? '全域光束' : game.banner);
  }

  const wrap = (value, period) => (value % period + period) % period;
  const hash = (x, y) => {
    const n = Math.imul(x + 129, 374761393) ^ Math.imul(y + 571, 668265263);
    return ((Math.imul(n ^ n >>> 13, 1274126177) ^ n >>> 16) >>> 0) / 4294967296;
  };

  function cloudNoise(u, v, across, vertical, seed) {
    const px = u * across, py = v * vertical;
    const x = Math.floor(px), y = Math.floor(py);
    const a = px - x, b = py - y;
    const fx = a * a * (3 - 2 * a), fy = b * b * (3 - 2 * b);
    const left = wrap(x, across), right = wrap(x + 1, across);
    const top = hash(left, y + seed) * (1 - fx) + hash(right, y + seed) * fx;
    const bottom = hash(left, y + 1 + seed) * (1 - fx) + hash(right, y + 1 + seed) * fx;
    return top * (1 - fy) + bottom * fy;
  }

  function buildNebula() {
    const makeLayer = (near) => {
      const tile = document.createElement('canvas');
      tile.width = 448;
      tile.height = 252;
      const brush = tile.getContext('2d');
      const frame = brush.createImageData(tile.width, tile.height);
      for (let y = 0; y < tile.height; y++) {
        const v = y / tile.height;
        for (let x = 0; x < tile.width; x++) {
          const u = x / tile.width;
          const curl = v + Math.sin(u * Math.PI * 2) * .038 + Math.sin(u * Math.PI * 4 + .7) * .021;
          const broad = cloudNoise(u, curl, 5, 11, near ? 55 : 13);
          const wisps = cloudNoise(u, curl + broad * .19, 11, 31, near ? 51 : 8);
          const grain = cloudNoise(u, v, 23, 48, 4);
          const strand = Math.exp(-(((curl - (near ? .58 : .43)) / (near ? .17 : .34)) ** 2));
          const mist = clamp((broad * .58 + wisps * .34 + grain * .08 - .31) * 1.68, 0, 1) * strand;
          const belt = Math.exp(-(((v - .5) / .36) ** 2));
          const i = (y * tile.width + x) * 4;
          frame.data[i] = near ? 67 + broad * 30 : 14 + 7 * belt + 15 * mist;
          frame.data[i + 1] = near ? 87 + broad * 22 : 17 + 10 * belt + 20 * mist;
          frame.data[i + 2] = near ? 190 + wisps * 37 : 60 + 26 * belt + 42 * mist;
          frame.data[i + 3] = near ? mist * 105 : 255;
        }
      }
      brush.putImageData(frame, 0, 0);
      return tile;
    };
    return [makeLayer(false), makeLayer(true)];
  }

  const stars = Array.from({ length: 94 }, (_, i) => ({
    x: hash(i, 1), y: hash(i, 2) * height,
    size: .65 + hash(i, 3) * 1.2, depth: hash(i, 4),
    alpha: .11 + hash(i, 5) * .42,
  }));

  function paintSky() {
    const t = motion.matches ? 0 : visualTime;
    nebula.forEach((tile, layer) => {
      const x = -wrap(t * (layer ? 12 : 3.6) - skyX * (layer ? 1.35 : .55), width);
      const y = -14 + skyY * (layer ? .7 : .25);
      ctx.drawImage(tile, x, y, width + 1, height + 28);
      ctx.drawImage(tile, x + width, y, width + 1, height + 28);
    });

    const moonX = wrap(618 - t * .83 + skyX * .4, width + 60) - 30;
    const moonY = 476 + skyY * .34;
    const moon = ctx.createRadialGradient(moonX + 12, moonY - 10, 1, moonX, moonY, 25);
    moon.addColorStop(0, '#6365b69c');
    moon.addColorStop(.35, '#46448882');
    moon.addColorStop(1, '#13154000');
    dot(moonX, moonY, 25, moon);
    for (const [i, star] of stars.entries()) {
      const speed = 5 + star.depth * 58;
      const x = wrap(star.x * width - t * speed + skyX * star.depth, width);
      const y = star.y + skyY * star.depth;
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = i % 5 === 0 ? '#b9a6ff' : '#a7ceff';
      ctx.fillRect(x, y, star.size * (1 + star.depth * 2), star.size);
      if (i % 13 === 0) {
        ctx.globalAlpha *= .54;
        ctx.fillRect(x - 5, y + .2, 13, .7);
        ctx.fillRect(x + 1, y - 3, .8, 8);
      }
    }
    ctx.globalAlpha = .25;
    for (let i = 0; i < 10; i++) {
      const x = wrap(hash(i, 18) * (width + 220) - t * (25 + i * 4), width + 220) - 220;
      const y = hash(i, 28) * height + skyY;
      const tail = 70 + hash(i, 19) * 144;
      const streak = ctx.createLinearGradient(x, y, x + tail, y);
      streak.addColorStop(0, '#627eff00');
      streak.addColorStop(.77, '#9db1ff6b');
      streak.addColorStop(1, '#9db1ff00');
      ctx.fillStyle = streak;
      ctx.fillRect(x, y, tail, i % 3 ? .8 : 1.6);
    }
    ctx.globalAlpha = 1;
  }

  function polygon(points, fill) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function dot(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintSprite(name, x, y, maxWidth, maxHeight, flashing = false, target = ctx) {
    const sprite = art[name];
    const scale = Math.min(maxWidth / sprite.naturalWidth, maxHeight / sprite.naturalHeight);
    const spriteWidth = sprite.naturalWidth * scale;
    const spriteHeight = sprite.naturalHeight * scale;
    const left = x - spriteWidth / 2;
    const top = y - spriteHeight / 2;
    target.drawImage(sprite, left, top, spriteWidth, spriteHeight);
    if (flashing) {
      target.save();
      target.globalAlpha *= .48;
      target.globalCompositeOperation = 'screen';
      target.drawImage(sprite, left, top, spriteWidth, spriteHeight);
      target.restore();
    }
  }

  function paintFeatherFan(target, skin, x, y, scale, opening, opacity) {
    target.save();
    target.translate(x, y);
    target.scale(scale, scale);
    target.globalCompositeOperation = 'screen';
    target.globalAlpha *= opacity;
    const gold = target.createLinearGradient(-78, 0, 2, 0);
    gold.addColorStop(0, `${skin.trail}00`);
    gold.addColorStop(.36, `${skin.trail}9c`);
    gold.addColorStop(.76, skin.accent);
    gold.addColorStop(1, skin.light);
    target.fillStyle = gold;
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const rear = 66 + i * 9;
        const spread = (10 + i * 8) * opening;
        const root = -5 - i * 4;
        const base = (4 + i * 1.9) * sign;
        const tip = spread * sign;
        target.beginPath();
        target.moveTo(root, base);
        target.quadraticCurveTo(-25, tip * .23, -rear, tip);
        target.quadraticCurveTo(-49, tip * .46, root - 6, base + sign * 3);
        target.closePath();
        target.fill();
      }
    }
    target.restore();
  }

  function paintPlayer(x, y, skin = game.skin, scale = playerScale, target = ctx) {
    const { rank, trail, light, accent } = skin;
    const still = motion.matches;
    const tick = still ? 0 : visualTime;
    const length = 26 + rank * 8 + Math.sin(tick * 19) * (rank ? 3 : 4);
    const tip = -44 - length;
    if (rank === 3) paintFeatherFan(target, skin, x - 23 * scale, y, scale, .78 + Math.sin(tick * 5) * .13, .62);
    target.save();
    target.translate(x, y);
    target.scale(scale, scale);
    const exhaust = target.createLinearGradient(tip, 0, -42, 0);
    exhaust.addColorStop(0, `${trail}00`);
    exhaust.addColorStop(.55, `${trail}7d`);
    exhaust.addColorStop(.87, rank >= 2 ? `${accent}bc` : `${trail}c8`);
    exhaust.addColorStop(1, `${light}e8`);
    target.fillStyle = exhaust;
    for (const offset of [-4.5, 3.5]) {
      const curl = rank > 1 ? Math.sin(tick * 11 + offset * .6) * (3 + rank) : 0;
      const span = 2.7 + rank * .45;
      target.beginPath();
      target.moveTo(-39, offset);
      target.bezierCurveTo(-44, offset - span * .5, -54, offset - span * 1.1, tip, offset + curl * 1.5);
      target.bezierCurveTo(-61, offset + span * 1.4, -44, offset + span * .6, -39, offset);
      target.closePath();
      target.fill();
      if (rank >= 2) {
        target.strokeStyle = `${light}b8`;
        target.lineWidth = .7;
        target.beginPath();
        target.moveTo(-44, offset);
        target.quadraticCurveTo(-57, offset - curl, tip + 10, offset + curl);
        target.stroke();
      }
    }
    if (rank > 0 && !still) {
      for (let i = 0; i < 3 + rank * 2; i++) {
        const phase = (tick * (1.2 + i * .024) + i * .618) % 1;
        const px = -47 - phase * (length + 6);
        const py = (i % 2 ? 1 : -1) * (4 + phase * (3 + rank * 2) * hash(i, 79));
        target.globalAlpha = (1 - phase) * .74;
        target.fillStyle = i % 3 ? light : accent;
        target.fillRect(px, py, rank === 1 ? 3.1 : 1.35, rank === 1 ? .8 : 1.25);
        if (rank === 3 && i % 3 === 0) {
          target.fillRect(px - 2, py + .4, 5.5, .5);
          target.fillRect(px + .4, py - 1.8, .5, 4.8);
        }
      }
    }
    target.restore();
    target.save();
    target.translate(x, y);
    target.scale(scale, scale);
    paintSprite(skinSprite(skin), -5, 0, 82, 48, false, target);
    target.restore();
  }

  function paintSkinArrival(target, skin, x, y, scale, age) {
    const { rank, accent, trail, light } = skin;
    const duration = [0.65, 1, 1.25, 1.7][rank];
    if (age < 0 || age >= duration) return;
    const still = motion.matches;
    const t = age / duration;
    const spread = still ? .5 : 1 - (1 - t) ** 2.8;
    const radius = 26 + 37 * spread;
    target.save();
    target.translate(x - 4 * scale, y);
    target.scale(scale, scale);
    target.globalAlpha = (1 - t) ** 1.45 * (still ? .36 : .85);
    const ringLight = target.createLinearGradient(-radius, -radius / 2, radius, radius / 2);
    ringLight.addColorStop(0, `${trail}16`);
    ringLight.addColorStop(.37, accent);
    ringLight.addColorStop(.62, light);
    ringLight.addColorStop(1, rank === 3 ? trail : `${accent}6d`);
    target.strokeStyle = ringLight;
    for (let i = 0; i < (rank === 3 ? 3 : rank === 2 ? 2 : 1); i++) {
      const r = radius - i * 8;
      const rotation = (i ? 1 : -1) * .22;
      target.lineWidth = i ? .48 : .92;
      target.beginPath();
      target.ellipse(0, 0, r, r * (.54 + i * .12), rotation, -.9 - spread, 2.5 + i);
      target.stroke();
    }
    if (rank === 3) {
      target.lineWidth = .6;
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        const ax = Math.cos(angle);
        const ay = Math.sin(angle) * .59;
        target.beginPath();
        target.moveTo(ax * (radius - 12), ay * (radius - 12));
        target.lineTo(ax * (radius + 4), ay * (radius + 4));
        target.stroke();
      }
    }
    if (rank && !still) {
      const facets = rank === 3 ? 12 : rank * 4;
      for (let i = 0; i < facets; i++) {
        const angle = i * Math.PI * 2 / facets + spread * .33;
        const r = radius * (1.04 + hash(i, 48) * .24);
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r * .59;
        const size = (rank === 3 ? 3.4 : 2.15) * (1 - t) * (.7 + hash(i, 41));
        target.fillStyle = i % 3 ? light : trail;
        target.beginPath();
        target.moveTo(px - size, py);
        target.quadraticCurveTo(px - size * .14, py - size * .19, px, py - size * 1.5);
        target.quadraticCurveTo(px + size * .14, py - size * .19, px + size, py);
        target.quadraticCurveTo(px + size * .14, py + size * .19, px, py + size * 1.5);
        target.quadraticCurveTo(px - size * .14, py + size * .19, px - size, py);
        target.fill();
        if (rank === 3 && i % 2 === 0) {
          target.lineWidth = .5;
          target.beginPath();
          target.moveTo(px * .83, py * .83);
          target.lineTo(px * .93, py * .93);
          target.stroke();
        }
      }
    }
    target.restore();
    if (rank === 3 && !still) {
      const flare = Math.sin(Math.PI * t) * (1 - t * .4);
      paintFeatherFan(target, skin, x + scale * 22, y, scale * 1.25, .74 + spread * .85, flare);
    }
  }

  function paintHangar() {
    const target = hangarCtx;
    const skin = inspectedSkin;
    const still = motion.matches;
    const age = visualTime - hangarBurstAt;
    const beamDemo = hangarDemo === 'beam' && age < 2.55;
    const shift = beamDemo ? Math.min(1, age * 4.4, (2.55 - age) * 3.6) : 0;
    const entrance = hangarDemo === 'arrival' && !still ? Math.max(0, 1 - age * 2) ** 2 : 0;
    const x = 511 - shift * 258 - entrance * 83;
    const y = 146 + (still ? 0 : Math.sin(visualTime * 1.7) * 6);
    const scale = 5.6 - shift * 1.25;
    target.clearRect(0, 0, hangarPreview.width, hangarPreview.height);
    for (let i = 0; i < 36; i++) {
      const px = 18 + hash(i, 91) * (hangarPreview.width - 36);
      const py = 10 + hash(i, 92) * (hangarPreview.height - 20);
      const shimmer = still ? .4 : .32 + .23 * Math.sin(visualTime * 1.9 + i * 1.6);
      target.globalAlpha = shimmer;
      target.fillStyle = i % 7 ? '#a8bbd9' : skin.accent;
      target.fillRect(px, py, i % 7 ? 1.5 : 2.6, i % 7 ? 1.5 : 2.6);
    }
    target.globalAlpha = 1;
    if (beamDemo) {
      const muzzle = x + scale * 36;
      if (age < .58) {
        paintBeamCharge(target, skin, muzzle, y, age / .58, 1.6);
      } else {
        const strength = Math.min(1, (age - .55) * 12, (2.55 - age) * 6);
        paintBeamField(target, skin, muzzle, y, hangarPreview.width, age - .58, strength, 1.55);
      }
    } else if (hangarDemo === 'arrival') {
      paintSkinArrival(target, skin, x, y, scale * .82, age);
    }
    paintPlayer(x, y, skin, scale, target);
    const edge = target.createLinearGradient(0, 0, hangarPreview.width, 0);
    edge.addColorStop(0, 'transparent');
    edge.addColorStop(.13, '#fff');
    edge.addColorStop(.91, '#fff');
    edge.addColorStop(1, 'transparent');
    target.save();
    target.globalCompositeOperation = 'destination-in';
    target.fillStyle = edge;
    target.fillRect(0, 0, hangarPreview.width, hangarPreview.height);
    target.restore();
  }

  function paintPickupAura(player) {
    const { x, y, aura } = player;
    if (!aura) return;
    const { age, label } = aura;
    const progress = age / pickupAuraDuration;
    const fade = 1 - progress;
    const flash = clamp((age - .035) / .095, 0, 1) * fade ** 1.45;
    const radius = motion.matches ? 59 : 38 + 29 * (1 - fade ** 2.8);
    ctx.save();
    ctx.translate(x - 5 * playerScale, y);
    ctx.scale(playerScale, playerScale);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = flash * (motion.matches ? .53 : 1.38);
    const glow = ctx.createRadialGradient(9, -4, 3, 8, 0, radius * 1.12);
    glow.addColorStop(0, '#fff1fbe5');
    glow.addColorStop(.25, '#f567ffe0');
    glow.addColorStop(.56, '#9252ffa2');
    glow.addColorStop(.84, '#4e66ff26');
    glow.addColorStop(1, '#595bff00');
    ctx.fillStyle = glow;
    ctx.fillRect(-radius * 1.3, -radius * 1.2, radius * 2.6, radius * 2.4);

    const rim = ctx.createLinearGradient(-radius, -radius, radius, radius * .68);
    rim.addColorStop(0, '#8296ff00');
    rim.addColorStop(.41, '#8ab6ffb0');
    rim.addColorStop(.73, '#d4c3ffed');
    rim.addColorStop(1, '#ed95f800');
    const sweep = motion.matches ? 0 : progress * .62;
    ctx.beginPath();
    ctx.ellipse(5, -1, radius, radius * .89, -.24, -1.62 + sweep, 1.96 + sweep);
    ctx.strokeStyle = rim;
    ctx.globalAlpha = flash * .30;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.globalAlpha = flash * .78;
    ctx.lineWidth = 1.1;
    ctx.stroke();

    for (const [i, px] of [-35, -24, -9, 5, 18, 34, 45].entries()) {
      const travel = clamp((age - i % 3 * .019) / (.23 + i % 4 * .032), 0, 1);
      const rise = motion.matches ? .25 : travel;
      const py = 37 + (i % 3) * 6 - rise * (49 + i % 4 * 8);
      const trail = 8 + (i % 3) * 5 + (1 - rise) * 11;
      ctx.globalAlpha = Math.sin(travel * Math.PI) ** .78 * fade * (motion.matches ? .32 : 1);
      const ray = ctx.createLinearGradient(px, py - 4, px, py + trail);
      ray.addColorStop(0, '#ddf5ff00');
      ray.addColorStop(.16, '#edfbffff');
      ray.addColorStop(.36, i % 2 ? '#cc79ffcd' : '#60b4ffcd');
      ray.addColorStop(1, '#4e70ff00');
      ctx.fillStyle = ray;
      ctx.fillRect(px - 1.35, py - 4, 2.7, trail + 4);
      dot(px, py, 1.4, '#e0eeff');
    }
    for (const [i, px] of [-37, -21, -9, 12, 29, 41].entries()) {
      const phase = clamp((age - .14 - i % 3 * .018) / .33, 0, 1);
      const py = (i % 2 ? -28 : 24) + i % 4 * 5 - (motion.matches ? 0 : phase * 13);
      ctx.globalAlpha = Math.sin(phase * Math.PI) * .64;
      dot(px, py, 1 + (i % 3) * .38, i % 2 ? '#fbd5ff' : '#b2d4ff');
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, age * 26) * clamp(fade * 3, 0, 1);
    ctx.fillStyle = '#fff7ff';
    ctx.textAlign = 'center';
    ctx.font = 'italic 700 13px system-ui, sans-serif';
    ctx.shadowColor = '#242058';
    ctx.shadowBlur = 6;
    ctx.fillText(label, 0, y < 49 * playerScale ? 42 : -42);
    ctx.restore();
  }

  function paintEnemy(enemy) {
    const flashing = !motion.matches && enemy.hit > .04;
    if (enemy.kind === 'pulse') {
      paintPulseEnemy(enemy, flashing);
      return;
    }
    paintSprite(enemy.kind, enemy.x, enemy.y, enemyArtWidths[enemy.kind] * enemyScale, enemy.radius * 2.26, flashing);
  }

  function paintPulseEnemy(enemy, flashing) {
    const { x, y, chargeAge } = enemy;
    const rush = pulseDrive(chargeAge);
    const beatPhase = chargeAge % .74;
    const beat = Math.max(0, 1 - Math.abs(beatPhase - .12) / .12);
    const echo = Math.max(0, 1 - Math.abs(beatPhase - .33) / .105) * .65;
    const glow = motion.matches ? .66 : Math.max(rush * .83, .28 + .72 * Math.max(beat, echo));
    const coreX = x - 15 * craftScale;
    const radius = (20 + glow * 13) * craftScale;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = glow;
    const halo = ctx.createRadialGradient(coreX, y, 0, coreX, y, radius);
    halo.addColorStop(0, '#ffb2d9');
    halo.addColorStop(.28, '#fa508fc0');
    halo.addColorStop(1, '#ed367e00');
    ctx.fillStyle = halo;
    ctx.fillRect(coreX - radius, y - radius, radius * 2, radius * 2);
    if (rush > 0) {
      const tail = x + 21 * craftScale;
      const tip = tail + (17 + rush * 78) * craftScale;
      const exhaust = ctx.createLinearGradient(tail, y, tip, y);
      exhaust.addColorStop(0, '#fff1d8');
      exhaust.addColorStop(.23, '#fa74afad');
      exhaust.addColorStop(1, '#ed367e00');
      ctx.globalAlpha = .38 + .58 * rush;
      polygon([[tail, y - 5 * craftScale], [tip, y], [tail, y + 5 * craftScale]], exhaust);
    }
    ctx.restore();

    paintSprite('striker', x, y, enemyArtWidths.striker * enemyScale, enemy.radius * 2.26, flashing);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = glow;
    ctx.strokeStyle = '#ff8fba';
    ctx.lineWidth = 1.5 * craftScale;
    ctx.beginPath();
    ctx.ellipse(coreX, y, (9 + glow * 5) * craftScale, (8 + glow * 7) * craftScale, 0, 0, Math.PI * 2);
    ctx.stroke();
    dot(coreX, y, (3 + glow * 2) * craftScale, '#ff83ae');
    ctx.restore();
  }

  function paintEnemyExplosion({ x, y, kind, life }) {
    const { duration, radius } = enemyBlasts[kind];
    const heavy = kind === 'heavy';
    const strength = life / duration;
    const progress = 1 - strength;
    const reach = radius * (motion.matches ? .68 : .37 + .63 * (1 - strength ** 2.4));
    const seed = Math.floor(x * 7 + y * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const haze = ctx.createRadialGradient(x, y, 0, x, y, reach * 1.38);
    haze.addColorStop(0, '#ffad47bf');
    haze.addColorStop(.54, '#f0522073');
    haze.addColorStop(1, '#99173c00');
    ctx.globalAlpha = strength * .89;
    ctx.fillStyle = haze;
    ctx.fillRect(x - reach * 1.4, y - reach * 1.4, reach * 2.8, reach * 2.8);

    const lobes = heavy ? 6 : 4;
    for (let i = 0; i < lobes; i++) {
      const angle = i * Math.PI * 2 / lobes + hash(i, seed) * .46;
      const drift = reach * (.20 + hash(i, seed + 1) * .34);
      const px = x + Math.cos(angle) * drift;
      const py = y + Math.sin(angle) * drift;
      const size = reach * (.32 + hash(i, seed + 2) * .23);
      const plasma = ctx.createRadialGradient(px, py, size * .05, px, py, size);
      plasma.addColorStop(0, i % 2 ? '#fff5b2' : '#fffdf0');
      plasma.addColorStop(.24, '#ffcf59');
      plasma.addColorStop(.51, '#ff8d29df');
      plasma.addColorStop(.8, '#de471759');
      plasma.addColorStop(1, '#c0232400');
      ctx.globalAlpha = strength ** (i % 2 ? 1.45 : 2.05);
      ctx.fillStyle = plasma;
      ctx.fillRect(px - size, py - size, size * 2, size * 2);
    }

    ctx.globalAlpha = strength ** 1.12;
    const rays = heavy ? 16 : 10;
    for (let i = 0; i < rays; i++) {
      const angle = Math.PI * 2 * (i + hash(i, seed) * .77) / rays;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const inner = reach * (.31 + hash(i, seed + 3) * .24);
      const tip = reach * (.77 + hash(i, seed + 1) * .48);
      const flare = reach * (.018 + hash(i, seed + 4) * .025);
      polygon([[x + dx * inner + dy * flare, y + dy * inner - dx * flare],
        [x + dx * tip, y + dy * tip],
        [x + dx * inner - dy * flare, y + dy * inner + dx * flare]],
      i % 3 ? '#ff9e44e0' : '#fff0ae');
    }
    if (heavy) {
      ctx.globalAlpha = Math.min(1, progress * 8) * strength * .71;
      ctx.lineWidth = 1.5 + strength * 2;
      ctx.strokeStyle = '#ffdb8b';
      ctx.beginPath();
      ctx.ellipse(x, y, reach * 1.22, reach * .82, -.27, .17, 2.96);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, reach * 1.22, reach * .82, -.27, 3.31, 6.02);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintPlasmaBlast(x, y, radius, strength, major) {
    const age = 1 - strength;
    const reach = motion.matches ? radius * .68 : radius * (.23 + .77 * (1 - strength ** 2.3));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = strength * .74;
    const haze = ctx.createRadialGradient(x, y, reach * .15, x, y, reach * 1.18);
    haze.addColorStop(0, '#ff8e57c9');
    haze.addColorStop(.56, '#e943614f');
    haze.addColorStop(1, '#ad497c00');
    ctx.fillStyle = haze;
    ctx.fillRect(x - reach * 1.2, y - reach * 1.2, reach * 2.4, reach * 2.4);

    const lobes = major ? [[0, 0, .56], [-.24, -.17, .40], [.23, .21, .36]] : [[0, 0, .61]];
    ctx.globalAlpha = strength ** 1.2;
    for (const [dx, dy, scale] of lobes) {
      const cx = x + reach * dx;
      const cy = y + reach * dy;
      const size = reach * scale;
      const fire = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
      fire.addColorStop(0, '#fff8dc');
      fire.addColorStop(.21, '#ffe09c');
      fire.addColorStop(.46, '#ff9b48d8');
      fire.addColorStop(.72, '#ff61246b');
      fire.addColorStop(1, '#ef463200');
      ctx.fillStyle = fire;
      ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    }

    const arcs = major ? [[1, -.25, '#ffc58e'], [.73, .34, '#f8a8bc']] : [[.88, -.24, '#ffc58e']];
    ctx.globalAlpha = Math.min(1, age * 6) * strength;
    for (const [scale, tilt, color] of arcs) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1 + strength * (major ? 2.6 : 1.3);
      ctx.beginPath();
      ctx.ellipse(x, y, reach * scale, reach * scale * .72, tilt, .36, 3.44);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, reach * scale, reach * scale * .72, tilt, 3.67, 6.18);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintBulletImpact({ x, y, color, life }) {
    const strength = life / impactDuration;
    const radius = motion.matches ? 9 : 6 + (1 - strength) * 13;
    ctx.save();
    ctx.globalAlpha = strength;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    polygon([[x - 13, y], [x - 3, y - 2], [x + 2, y - 9], [x + 4, y - 2],
      [x + 11, y], [x + 3, y + 2], [x - 1, y + 7], [x - 3, y + 2]], '#f5ffff');
    ctx.restore();
  }

  function paintArrival(age) {
    if (age >= bossEntryEnd) return;
    const envelope = clamp(age / .12, 0, 1) * clamp((bossEntryEnd - age) / .85, 0, 1);
    const pulse = motion.matches ? .72 : .74 + Math.sin(age * 11) * .20;
    ctx.save();
    ctx.globalAlpha = envelope * pulse;
    const edge = ctx.createLinearGradient(width * .48, 0, width, 0);
    edge.addColorStop(0, '#d6275200');
    edge.addColorStop(.72, '#e63f543d');
    edge.addColorStop(1, '#ff5260b0');
    ctx.fillStyle = edge;
    ctx.fillRect(width * .48, 0, width * .52, height);

    const border = ctx.createLinearGradient(0, 0, 0, height);
    border.addColorStop(0, '#fb4764ad');
    border.addColorStop(.09, '#ec335000');
    border.addColorStop(.91, '#ec335000');
    border.addColorStop(1, '#fb4764ad');
    ctx.fillStyle = border;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ff9b81';
    ctx.fillRect(width - 3, 0, 3, height);
    for (let i = 0; i < 6; i++) {
      const y = height - 100 + i * 11;
      polygon([[width - 51, y + 5], [width - 24, y - 5], [width - 12, y - 5], [width - 39, y + 5]], '#ffad866b');
    }
    ctx.restore();
  }

  const riftProfile = [-.06, .015, -.03, .016, -.018, .07, -.052, -.008, .034, -.018, .025, -.055, -.02];

  function paintRift(boss) {
    const { x: coreX, y: coreY } = bossCoreAt(boss.x, boss.y);
    const heightScale = bossSpriteHeight * 1.13;
    const reveal = clamp((boss.age - .22) / .42, 0, 1);
    if (reveal <= 0 || coreX < -50) return;
    const x = Math.min(width - 12, coreX - 9);
    const y = coreY - heightScale * .5;
    const intensity = clamp(1 - (boss.age - bossEntryEnd * .62) / 1.05, 0, 1);
    const flicker = motion.matches ? 0 : Math.sin(visualTime * 24) * 2;
    const points = riftProfile.map((offset, i) => [
      x + offset * heightScale + (i % 2 ? flicker : -flicker),
      y + i / (riftProfile.length - 1) * heightScale,
    ]);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = reveal * (.54 + intensity * .43);
    ctx.save();
    ctx.translate(x, coreY);
    ctx.scale(1, heightScale * .61 / 105);
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 105);
    glow.addColorStop(0, '#ffb25368');
    glow.addColorStop(.35, '#f5733539');
    glow.addColorStop(.77, '#ed683513');
    glow.addColorStop(1, '#ed683500');
    ctx.fillStyle = glow;
    ctx.fillRect(-105, -105, 210, 210);
    ctx.restore();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) {
      const [startX, startY] = points[i - 1];
      const [endX, endY] = points[i];
      ctx.lineTo(startX + (endX - startX) * .42 + (hash(i, 117) - .5) * 13,
        startY + (endY - startY) * .37);
      ctx.lineTo(endX, endY);
    }
    for (const [color, lineWidth] of [['#eb4c2a38', 19], ['#ff8e48a0', 7], ['#ffe39edc', 2.2]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffab529d';
    ctx.lineWidth = 1.3;
    for (const i of [2, 4, 6, 9, 11]) {
      const [px, py] = points[i];
      const stretch = 15 + hash(i, 13) * 29 + intensity * 17;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - stretch * .45, py + 8 - i * 1.8);
      ctx.lineTo(px - stretch, py - 7 + (i % 3) * 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintBoss(x, y, pulse = 0, inBattle = false) {
    const { boss: look, coreScale } = game.sector;
    const spriteHeight = inBattle ? bossSpriteHeight : 330;
    const { x: coreX, y: coreY } = bossCoreAt(x, y, spriteHeight);
    const glowRadius = inBattle ? 89 : 72;
    const halo = ctx.createRadialGradient(coreX, coreY, 4, coreX, coreY, glowRadius);
    halo.addColorStop(0, `${look.tint}70`);
    halo.addColorStop(.55, `${look.tint}24`);
    halo.addColorStop(1, `${look.tint}00`);
    ctx.fillStyle = halo;
    ctx.fillRect(coreX - glowRadius, coreY - glowRadius, glowRadius * 2, glowRadius * 2);
    paintSprite(look.sprite, x, y, spriteHeight * bossAspect, spriteHeight, !motion.matches && pulse > .04);
    if (inBattle) {
      ctx.strokeStyle = pulse > .04 ? '#fff8eb' : `${look.tint}d4`;
      ctx.lineWidth = 1.6;
      for (const angle of [.13, 1.7, 3.27, 4.84]) {
        ctx.beginPath();
        ctx.ellipse(coreX, coreY, coreRadiusX * coreScale + 4, coreRadiusY * coreScale + 4, 0, angle, angle + .68);
        ctx.stroke();
      }
    }
  }

  function paintBeamCharge(target, skin, x, y, progress, scale = 1) {
    target.save();
    target.translate(x, y);
    target.scale(scale, scale);
    const light = target.createRadialGradient(0, 0, 1, 0, 0, 40 + progress * 34);
    light.addColorStop(0, skin.light);
    light.addColorStop(.2, `${skin.accent}d9`);
    light.addColorStop(.55, `${skin.trail}72`);
    light.addColorStop(1, `${skin.trail}00`);
    target.globalCompositeOperation = 'screen';
    target.globalAlpha = .22 + progress * .78;
    target.fillStyle = light;
    target.fillRect(-75, -75, 150, 150);
    target.lineWidth = 1.1 + progress * 1.5;
    for (let i = 0; i < 2 + skin.rank; i++) {
      const reach = motion.matches ? 32 + i * 8 : 72 - progress * 48 + i * 9;
      const angle = i * 2.1 + (motion.matches ? 0 : progress * 2);
      target.strokeStyle = i % 2 ? skin.trail : skin.accent;
      target.beginPath();
      target.ellipse(0, 0, reach * .62, reach, .45, angle, angle + 1.45);
      target.stroke();
    }
    const length = 11 + progress ** 2 * 48;
    target.fillStyle = skin.light;
    target.beginPath();
    target.moveTo(-length, 0);
    target.quadraticCurveTo(-3, -2, 0, -length * .57);
    target.quadraticCurveTo(3, -2, length, 0);
    target.quadraticCurveTo(3, 2, 0, length * .57);
    target.quadraticCurveTo(-3, 2, -length, 0);
    target.fill();
    target.restore();
  }

  function paintBeamWake() {
    const { beam, player, skin } = game;
    const elapsed = beamDuration + beamWindup - beam;
    const firing = beam <= beamDuration;
    const age = beamDuration - beam;
    const wash = firing ? clamp((.72 - age) / .62, 0, 1) : clamp(elapsed / .1, 0, 1) * .8;
    if (wash <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = wash * (motion.matches ? .24 : .78);
    const wake = ctx.createLinearGradient(0, 0, 0, height);
    wake.addColorStop(0, `${skin.trail}78`);
    wake.addColorStop(.24, `${skin.trail}34`);
    wake.addColorStop(.46, '#04071700');
    wake.addColorStop(.66, '#04071700');
    wake.addColorStop(1, `${skin.trail}69`);
    ctx.fillStyle = wake;
    ctx.fillRect(0, 0, width, height);
    if (motion.matches) {
      ctx.restore();
      return;
    }
    const cutIn = firing ? 0 : clamp(elapsed / .08, 0, 1) * clamp((.37 - elapsed) / .22, 0, 1);
    if (cutIn > 0) {
      const centerY = clamp(player.y, 110, height - 110);
      const light = ctx.createLinearGradient(0, centerY - 101, 0, centerY + 98);
      light.addColorStop(0, '#6b93ff00');
      light.addColorStop(.37, `${game.skin.light}72`);
      light.addColorStop(.6, `${game.skin.trail}62`);
      light.addColorStop(1, '#8ca4ff00');
      ctx.globalAlpha = cutIn * .88;
      ctx.fillStyle = light;
      ctx.fillRect(0, centerY - 101, width, 199);
      ctx.globalAlpha = cutIn * .47;
      if (skin.rank === 3) paintFeatherFan(ctx, skin, width * (.25 + elapsed * .48), centerY, 4.1, 1.1, .85);
      paintSprite(skinSprite(game.skin), width * (.25 + elapsed * .48), centerY + 1, 400, 188, true);
    }
    ctx.globalAlpha = wash * .76;
    for (let i = 0; i < 24; i++) {
      const run = wrap(hash(i, 61) * width + elapsed * (1300 + i * 68), width + 350) - 350;
      const y = hash(i, 62) * height;
      ctx.fillStyle = i % 4 === 0 ? `${skin.accent}ae` : `${skin.light}a8`;
      ctx.fillRect(run, y, 40 + hash(i, 63) * 263, i % 5 ? 1.3 : 3.3);
    }
    ctx.restore();
  }

  function paintBeam() {
    const { player, beam, beamContact, skin } = game;
    const x = player.x + muzzleOffset - 2;
    if (beam > beamDuration) {
      paintBeamCharge(ctx, skin, x, player.y, 1 - (beam - beamDuration) / beamWindup);
      return;
    }
    const age = beamDuration - beam;
    const strength = Math.min(1, (age + .05) * 13, beam * 6);
    paintBeamField(ctx, skin, x, player.y, width, age, strength);
    if (beamContact) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      paintContact(beamContact, strength, skin);
      ctx.restore();
    }
  }

  function paintBeamField(target, skin, x, y, end, age, strength, scale = 1) {
    const still = motion.matches;
    const radius = (39 + (still ? 0 : Math.sin(visualTime * 24) * 3)) * strength * scale;
    const distance = end - x;
    if (distance <= 0 || radius <= 0) return;
    const { rank, accent, trail, light } = skin;
    target.save();
    target.translate(x, y);
    target.globalCompositeOperation = 'screen';
    const stream = target.createLinearGradient(0, -radius, 0, radius);
    stream.addColorStop(0, `${trail}00`);
    stream.addColorStop(.21, `${trail}9e`);
    stream.addColorStop(.39, `${accent}ec`);
    stream.addColorStop(.47, light);
    stream.addColorStop(.53, light);
    stream.addColorStop(.61, `${accent}ec`);
    stream.addColorStop(.79, `${trail}9e`);
    stream.addColorStop(1, `${trail}00`);
    target.fillStyle = stream;
    const throat = Math.min(distance * .24, 44 * scale);
    target.beginPath();
    target.moveTo(0, -radius * .2);
    target.quadraticCurveTo(throat * .54, -radius, throat, -radius);
    target.lineTo(distance, -radius);
    target.lineTo(distance, radius);
    target.lineTo(throat, radius);
    target.quadraticCurveTo(throat * .54, radius, 0, radius * .2);
    target.closePath();
    target.fill();

    if (!still) {
      for (const sign of [-1, 1]) {
        target.strokeStyle = rank === 3 ? accent : light;
        target.lineWidth = (rank === 3 ? 1.7 : 1) * scale;
        target.beginPath();
        target.moveTo(0, 0);
        for (let i = 1; i <= 26; i++) {
          const phase = i / 26;
          const ripple = Math.sin(phase * 13 - visualTime * 16);
          target.lineTo(distance * phase, sign * radius * (.61 + ripple * .21) * Math.min(1, phase * 9));
        }
        target.stroke();
      }
      for (let i = 0; i < 7 + rank * 3; i++) {
        const run = (visualTime * (760 + 41 * i) + i * 137) % distance;
        const edge = (i % 2 ? 1 : -1) * radius * (.69 + hash(i, 32) * .39);
        const length = Math.min((12 + hash(i, 33) * 32) * scale, distance - run);
        target.fillStyle = i % 3 ? `${accent}a8` : `${trail}c6`;
        target.beginPath();
        target.moveTo(run - length * .4, edge);
        target.lineTo(run + length * .72, edge - (i % 2 ? 2.6 : -2.6) * scale);
        target.lineTo(run + length, edge);
        target.lineTo(run + length * .63, edge + 1.3 * scale);
        target.fill();
      }
    }
    for (let i = 0; i < 1 + rank; i++) {
      target.strokeStyle = i % 2 ? trail : accent;
      target.lineWidth = (i === 0 ? 2.3 : 1.15) * scale;
      target.beginPath();
      target.ellipse(i * 7 * scale, 0, 10 * scale + radius * .2, radius * (.77 + i * .15), .12 - i * .14, i * .64, 6.14);
      target.stroke();
    }
    target.restore();
    if (rank === 3 && !still && age < .8) {
      paintFeatherFan(target, skin, x + 22 * scale, y, scale * 1.22, 1.35, (1 - age / .8) * strength);
    }
  }

  function paintContact({ x, y }, strength, skin) {
    ctx.globalAlpha = strength;
    const light = ctx.createRadialGradient(x, y, 1, x, y, 84);
    light.addColorStop(0, '#fffbe8');
    light.addColorStop(.16, skin.accent);
    light.addColorStop(.46, `${skin.trail}8e`);
    light.addColorStop(1, `${skin.trail}00`);
    ctx.fillStyle = light;
    ctx.fillRect(x - 84, y - 84, 168, 168);
    polygon([[x - 46, y], [x - 7, y - 8], [x + 5, y - 34], [x + 10, y - 8],
      [x + 66, y], [x + 9, y + 7], [x - 2, y + 29], [x - 7, y + 7]], '#fff9df');
    ctx.strokeStyle = `${skin.accent}cf`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x + 7, y, 20, 51, .22, .45, 5.5);
    ctx.stroke();
  }

  function paintShock(shock) {
    const { x, y } = shock;
    const fade = shock.remaining / shock.duration;
    const radius = motion.matches ? 54 : 100 * (1 - fade ** 2) + 18;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = fade;
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, '#bffffee0');
    light.addColorStop(.33, '#85caff60');
    light.addColorStop(1, '#a285ff00');
    ctx.fillStyle = light;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    for (const [scale, color] of [[.68, '#fff4cd'], [1, '#d3c7ff']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 + fade * 2;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * scale * .78, radius * scale, .18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintBossWreck({ x, y, age }) {
    const name = game.sector.boss.sprite;
    if (age < bossBreakAt) {
      paintSprite(name, x, y, bossSpriteWidth, bossSpriteHeight, !motion.matches && age < .17);
      return;
    }
    const drift = age - bossBreakAt;
    const fade = clamp((2.85 - age) / 1.55, 0, 1);
    if (fade === 0) return;
    const sprite = art[name];
    const scale = bossSpriteHeight / sprite.naturalHeight;
    const sourceW = sprite.naturalWidth / 2;
    const sourceH = sprite.naturalHeight / 3;
    const w = sourceW * scale;
    const h = sourceH * scale;
    const spread = motion.matches ? .23 : 1 - Math.exp(-drift * 1.65);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const side = col === 0 ? -1 : 1;
        const lift = row - 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(x + side * (w / 2 + spread * (62 + row * 17)),
          y + lift * h + spread * (lift * (88 + col * 16) + side * 26));
        if (!motion.matches) ctx.rotate(spread * side * (.21 + row * .18));
        ctx.drawImage(sprite, col * sourceW, row * sourceH, sourceW, sourceH, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }
  }

  function paintBossDetonation({ x, y, age }) {
    const waveAge = age - bossBreakAt;
    if (waveAge >= 0) {
      const centerX = x - 12 * bossScale;
      const fade = clamp(1 - waveAge / (bossDefeatDuration - bossBreakAt), 0, 1);
      const reach = (motion.matches ? 245 : 132 + 208 * (1 - Math.exp(-waveAge * 2))) * bossScale;
      const haze = ctx.createRadialGradient(centerX, y, 0, centerX, y, reach);
      haze.addColorStop(0, '#ff9157af');
      haze.addColorStop(.35, '#e9646170');
      haze.addColorStop(.67, '#ab55903f');
      haze.addColorStop(1, '#a347b000');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(1, waveAge * 8) * fade * .8;
      ctx.fillStyle = haze;
      ctx.fillRect(centerX - reach, y - reach, reach * 2, reach * 2);

      for (const [delay, color] of [[0, '#fff5df'], [.17, '#c6a7ff'], [.32, '#ff9963']]) {
        const t = (waveAge - delay) / 1.32;
        if (t < 0 || t >= 1) continue;
        const radius = (motion.matches ? 185 : 34 + 344 * (1 - (1 - t) ** 2)) * bossScale;
        ctx.globalAlpha = Math.min(1, t * 21) * (1 - t) ** 1.42 * .82;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 + (1 - t) * 4;
        ctx.beginPath();
        ctx.ellipse(centerX, y, radius, radius * .74, -.18 + delay, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!motion.matches && waveAge < .24) {
        ctx.globalAlpha = .21 * (1 - waveAge / .24) ** 2;
        ctx.fillStyle = '#ffdbb5';
        ctx.fillRect(-24, -24, width + 48, height + 48);
      }
      ctx.restore();
    }

    for (const blast of bossBlasts) {
      const progress = (age - blast.at) / blast.duration;
      if (progress < 0 || progress >= 1) continue;
      paintPlasmaBlast(x + blast.dx * bossScale, y + blast.dy * bossScale,
        blast.radius * bossScale, 1 - progress, blast.radius >= 100);
    }
  }

  function paintPickup(pickup) {
    const { x, y, kind } = pickup;
    const { sprite, radius: size, glow, edge } = pickupTypes[kind];
    const radius = size * craftScale;
    const phase = motion.matches ? 0 : pickup.age * 1.6;
    ctx.save();
    const halo = ctx.createRadialGradient(x, y, radius * .45, x, y, radius * 1.65);
    halo.addColorStop(0, glow);
    halo.addColorStop(1, '#374ca200');
    ctx.fillStyle = halo;
    ctx.fillRect(x - radius * 1.65, y - radius * 1.65, radius * 3.3, radius * 3.3);
    paintSprite(sprite, x, y, radius * 2, radius * 2);
    ctx.lineWidth = .9;
    ctx.strokeStyle = edge;
    for (const offset of [0, Math.PI]) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 2, phase + offset, phase + offset + .8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function paintPulseWarnings() {
    if (game.mode !== 'play' || game.level === 0) return;
    for (let i = game.nextWave; i < game.waves.length; i++) {
      const [at, lane, kind] = game.waves[i];
      const remaining = at - game.elapsed;
      if (remaining > pulseWarningTime) break;
      if (kind !== 'pulse') continue;
      const x = width - 42;
      const y = lane * height;
      const fade = motion.matches ? .8 : clamp((pulseWarningTime - remaining) * 6, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      const glow = ctx.createLinearGradient(x - 42, y, width, y);
      glow.addColorStop(0, '#ff557c00');
      glow.addColorStop(.75, '#ff557c52');
      glow.addColorStop(1, '#ff557c00');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 42, y - 13, width - x + 42, 26);
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#ffd2e4';
      for (const offset of [-13, 0, 13]) {
        ctx.beginPath();
        ctx.moveTo(x + offset + 5, y - 6);
        ctx.lineTo(x + offset - 2, y);
        ctx.lineTo(x + offset + 5, y + 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function paintDefenseLine(boss) {
    const danger = boss.x < bossDangerX;
    ctx.save();
    ctx.globalAlpha = danger ? (motion.matches ? .74 : .72 + Math.sin(visualTime * 7) * .16) : .42;
    const edge = ctx.createLinearGradient(0, 0, defenseLine + 26, 0);
    edge.addColorStop(0, danger ? '#f2555b7a' : '#8db7ec50');
    edge.addColorStop(1, '#10162b00');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, defenseLine + 26, height);
    ctx.strokeStyle = danger ? '#ffa07e' : '#98c1f0';
    ctx.lineWidth = danger ? 2.5 : 1.5;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(defenseLine, 0);
    ctx.lineTo(defenseLine, height);
    ctx.stroke();
    ctx.restore();
  }

  function paintPlayerBolt(bolt, skin) {
    ctx.save();
    ctx.translate(bolt.x, bolt.y);
    ctx.rotate(bolt.angle);
    if (skin.rank < 2) {
      paintSprite('bullet', -4, 0, 34 * craftScale, 7 * craftScale);
    } else {
      ctx.scale(craftScale, craftScale);
      const metal = ctx.createLinearGradient(-26, 0, 14, 0);
      metal.addColorStop(0, `${skin.trail}00`);
      metal.addColorStop(.44, skin.trail);
      metal.addColorStop(.78, skin.accent);
      metal.addColorStop(1, skin.light);
      polygon([[-26, 0], [-5, -2.3], [2, -3.8], [14, 0], [2, 3.8], [-5, 2.3]], metal);
      if (skin.rank === 3) {
        polygon([[-14, -5], [2, -2], [5, 0], [-2, -1]], '#a56afa9a');
        polygon([[-14, 5], [2, 2], [5, 0], [-2, 1]], '#a56afa9a');
      }
    }
    ctx.restore();
  }

  function paint() {
    paintSky();
    if (game.mode === 'ready') {
      const wide = landscapeViewport();
      const bossX = wide ? width * .79 : width - 155;
      const bossY = wide ? 290 : 242;
      paintBoss(bossX, bossY + Math.sin(visualTime * 1.3) * 6);
      paintPlayer(width * (wide ? .57 : 588 / baseWidth), 361 + Math.sin(visualTime * 2) * 4, equippedSkin, 1.51);
      return;
    }
    const boss = game.boss;
    if (game.beam > 0) paintBeamWake();
    if (boss) {
      paintArrival(boss.age);
      paintDefenseLine(boss);
    }
    const { shock, bossDefeat } = game;
    ctx.save();
    if (!motion.matches && (shock || bossDefeat)) {
      const kick = shock ? (shock.remaining / shock.duration) ** 4 * 5 :
        bossDefeat.age < bossBreakAt ? 3 * Math.exp(-bossDefeat.age * 6) :
          19 * Math.exp(-(bossDefeat.age - bossBreakAt) * 3.6);
      ctx.translate(Math.sin(visualTime * 93) * kick, Math.cos(visualTime * 117) * kick * .55);
    }
    if (boss) paintBoss(boss.x, boss.y, boss.hit, true);
    if (boss) paintRift(boss);
    if (bossDefeat) paintBossWreck(bossDefeat);
    paintPulseWarnings();
    for (const enemy of game.enemies) paintEnemy(enemy);
    for (const pickup of game.pickups) paintPickup(pickup);
    for (const bolt of game.bolts) paintPlayerBolt(bolt, game.skin);
    if (game.beam > 0) paintBeam();
    if (shock) paintShock(shock);
    if (bossDefeat) paintBossDetonation(bossDefeat);
    for (const explosion of game.explosions) paintEnemyExplosion(explosion);
    for (const impact of game.impacts) paintBulletImpact(impact);
    const { player } = game;
    if (player.alive) {
      if (game.mode === 'play' && game.level === 0) paintSkinArrival(ctx, game.skin, player.x, player.y, playerScale, game.elapsed);
      paintPlayer(player.x, player.y);
      paintPickupAura(player);
    }
    for (const particle of game.particles) {
      const fade = particle.life / particle.maxLife;
      ctx.globalAlpha = fade;
      if (particle.debris && !motion.matches) {
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = 1 + particle.size * .23;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - particle.vx * fade * .046, particle.y - particle.vy * fade * .046);
        ctx.stroke();
      }
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.restore();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, touchDevice ? 1.5 : 2);
    const pixelWidth = Math.max(1, Math.round(rect.width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(rect.height * pixelRatio));
    const viewWidth = landscapeViewport() ? height * pixelWidth / pixelHeight : baseWidth;
    dragScaleX = viewWidth / rect.width;
    dragScaleY = height / rect.height;
    if (canvas.width === pixelWidth && canvas.height === pixelHeight && width === viewWidth) return;
    width = viewWidth;
    if (inSortie() && game.player.x > width - 44 * playerScale) movePlayer(game.player.x, game.player.y);
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  }

  function frame(now) {
    if (document.hidden) {
      lastFrame = null;
      requestAnimationFrame(frame);
      return;
    }
    const dt = lastFrame === null || paused ? 0 : Math.min((now - lastFrame) / 1000, .05);
    lastFrame = now;
    visualTime += dt;
    if (hangar.open) {
      if (hangarFilmPreview.hidden) paintHangar();
      requestAnimationFrame(frame);
      return;
    }
    const steps = Math.max(1, Math.ceil(dt / .025));
    if (!paused) for (let i = 0; i < steps; i++) step(dt / steps);
    if (motion.matches) {
      skyX = skyY = 0;
    } else {
      const player = game.player;
      const easing = 1 - Math.exp(-dt * 4);
      skyX += ((155 - player.x) * .024 - skyX) * easing;
      skyY += ((height / 2 - player.y) * .025 - skyY) * easing;
    }
    paint();
    updateHud();
    requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(canvas);
  updateFullscreen();
  updateHud();
  loadArt().then(() => {
    initHangar();
    startButton.firstChild.textContent = '开始出击 ';
    startButton.disabled = false;
    requestAnimationFrame(frame);
  }, () => {
    overlay.classList.remove('is-home');
    byId('brief-text').textContent = '美术素材未能载入，请刷新页面重试。';
    startButton.firstChild.textContent = '素材载入失败 ';
  });
})();
