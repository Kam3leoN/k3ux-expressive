/**
 * Fireworks — composant autonome (aucune dépendance externe).
 *
 * Porté depuis le script original de Caleb Miller (https://cmiller.tech/), qui
 * s'appuyait sur `Stage`, `MyMath` et `fscreen` (ressources CodePen) et sur une
 * UI (boutons play/pause/settings + menu). Ici tout ça est retiré :
 *
 *  - Le composant crée son propre conteneur plein écran, en position `fixed`,
 *    DERRIÈRE le contenu par défaut (`z-index: -1`) ou DEVANT (`layer: front`,
 *    z-index 450) avec `pointer-events: none` : aucun clic, scroll ni saisie bloqués.
 *  - Aucune icône ni menu : TOUT se pilote par l'API (options + méthodes).
 *  - Formes et couleurs conservées depuis le script d'origine. Le son est
 *    désormais SYNTHÉTISÉ en direct (Web Audio) par défaut — aucun fichier
 *    externe, il fonctionne donc hors-ligne et en `file://`. Les échantillons
 *    mp3 d'origine restent utilisables via l'option `soundMode: 'samples'`.
 *  - Ajout d'un ordonnanceur de séquences personnalisées (ex. « 2 puis 3 puis
 *    2 puis bouquet final ») cadencé sur l'horloge de simulation (donc respecte
 *    la pause).
 *
 * NOTE : l'état de rendu (particules, qualité, échelle…) est porté au niveau du
 * module pour rester fidèle à l'original et limiter les régressions. En pratique
 * cela signifie UNE instance active par page — largement suffisant pour un fond
 * d'écran de feux d'artifice.
 */

// =========================================================================== //
//  Types publics
// =========================================================================== //

export type ShellTypeName =
  | 'Random'
  | 'Crackle'
  | 'Crossette'
  | 'Crysanthemum'
  | 'Falling Leaves'
  | 'Floral'
  | 'Ghost'
  | 'Horse Tail'
  | 'Palm'
  | 'Ring'
  | 'Strobe'
  | 'Willow';

/** 1 = Basse, 2 = Normale, 3 = Haute */
export type Quality = 1 | 2 | 3;
/** 0 = Aucun, 1 = Léger, 2 = Normal */
export type SkyLighting = 0 | 1 | 2;
/**
 * Source du son :
 *  - 'samples' : échantillons audio d'origine (mp3 / data-URI) — défaut K3ui v1.
 *  - 'synth'   : sons synthétisés en direct (sans fichiers externes).
 */
export type SoundMode = 'synth' | 'samples';

export interface FireworksConfig {
  /** Qualité graphique (nombre de particules). */
  quality: Quality;
  /** Type de tir. « Random » pour un assortiment. */
  shell: ShellTypeName;
  /** Taille des obus, ~0 à 5 (calqué sur les tailles réelles 3"→16"). */
  size: number;
  /** Tir automatique de séquences aléatoires. */
  autoLaunch: boolean;
  /** Mode final : rafales intenses (nécessite autoLaunch). */
  finale: boolean;
  /** Illumine le ciel derrière les explosions. */
  skyLighting: SkyLighting;
  /** Effet « pose longue » : ralentit l'effacement des empreintes (nécessite imprints). */
  longExposure: boolean;
  /** Traînées colorées pendant le vol des particules (défaut : true). */
  trails: boolean;
  /** Empreintes persistantes sur le canvas après le passage des particules (défaut : false). */
  imprints: boolean;
  /** Échelle globale (permet de « s'éloigner » des feux). */
  scaleFactor: number;
  /** Son activé (nécessite une interaction utilisateur pour démarrer l'audio). */
  soundEnabled: boolean;
}

export interface FireworksOptions extends Partial<FireworksConfig> {
  /** Élément hôte où monter le canvas (défaut : document.body). */
  container?: HTMLElement;
  /** z-index du conteneur. Utiliser `layer: 'front'` (450) ou une valeur explicite. */
  zIndex?: number;
  /** Démarre l'animation immédiatement (défaut : true). */
  autoStart?: boolean;
  /** Active le rendu haute densité (Retina). Défaut : true. */
  highDPI?: boolean;
  /**
   * Ne peint jamais le fond du conteneur (transparent). Les feux se superposent
   * alors à la page existante (idéal pour une intégration où le fond est géré
   * ailleurs, ex. thème k3ui). Désactive l'illumination du ciel. Défaut : false.
   */
  transparentBackground?: boolean;
  /** Source du son (défaut CE : 'samples' — mp3 exacts v1). */
  soundMode?: SoundMode;
  /** URL de base des fichiers audio (utilisé uniquement si soundMode = 'samples'). */
  soundBaseUrl?: string;
  /**
   * URLs audio personnalisées par type de son (`lift`, `burst`, `burstSmall`,
   * `crackle`, `crackleSmall`). Chaque entrée est une liste d'URLs (une variation
   * tirée au hasard à chaque lecture). Les data-URIs (`data:audio/mpeg;base64,…`)
   * sont acceptées, ce qui permet d'embarquer les sons dans la page sans réseau.
   * Fournir cette option bascule automatiquement en mode 'samples'.
   */
  soundSources?: Partial<Record<string, string[]>>;
}

/** Une salve d'une séquence personnalisée. */
export interface SequenceSalvo {
  /** Nombre d'obus à tirer simultanément (défaut : 1). */
  count?: number;
  /** Salve « bouquet final » : rafale dense de tirs rapides. */
  finale?: boolean;
  /** Nombre d'obus du bouquet final (défaut : 24). */
  finaleCount?: number;
  /** Pause pure (ms), sans tir. */
  wait?: number;
  /** Forcer un type de tir pour cette salve. */
  shell?: ShellTypeName;
  /** Forcer une taille pour cette salve. */
  size?: number;
  /** Délai (ms) avant la salve suivante. Sinon calculé automatiquement. */
  delay?: number;
}

export interface SequenceOptions {
  /** Boucler la séquence indéfiniment. */
  loop?: boolean;
  /** Callback appelé quand la séquence se termine (non bouclée). */
  onEnd?: () => void;
}

// =========================================================================== //
//  Constantes & détection d'environnement
// =========================================================================== //

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 640;
const IS_DESKTOP = typeof window !== 'undefined' && window.innerWidth > 800;
const IS_HIGH_END_DEVICE = (() => {
  const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0;
  if (!hw) return false;
  const minCount = window.innerWidth <= 1024 ? 4 : 8;
  return hw >= minCount;
})();

// Bride la taille des canvas sur des écrans démesurés (8K).
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9;

const QUALITY_LOW = 1;
const QUALITY_NORMAL = 2;
const QUALITY_HIGH = 3;

const SKY_LIGHT_NONE = 0;
const SKY_LIGHT_NORMAL = 2;

const COLOR = {
  Red: '#ff0043',
  Green: '#14fc56',
  Blue: '#1e7fff',
  Purple: '#e60aff',
  Gold: '#ffbf36',
  White: '#ffffff',
};

// Couleur invisible spéciale (non rendue, mais la physique s'applique).
const INVISIBLE = '_INVISIBLE_';

const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

function getDefaultScaleFactor(): number {
  if (IS_MOBILE) return 0.9;
  return 1;
}

// =========================================================================== //
//  Helper mathématique (remplace `MyMath`)
// =========================================================================== //

const MyMath = {
  random: (min: number, max: number) => Math.random() * (max - min) + min,
  randomInt: (min: number, max: number) => ((Math.random() * (max - min + 1)) | 0) + min,
  randomChoice: <T>(arr: T[]): T => arr[(Math.random() * arr.length) | 0],
  clamp: (v: number, min: number, max: number) => Math.min(Math.max(v, min), max),
  pointDist: (x1: number, y1: number, x2: number, y2: number) =>
    Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)),
  // Angle cohérent avec le modèle de vitesse (speedX = sin(a)*s, speedY = cos(a)*s).
  pointAngle: (x1: number, y1: number, x2: number, y2: number) =>
    Math.atan2(x2 - x1, y2 - y1),
};

// =========================================================================== //
//  État du module (fidèle à l'original — une instance active à la fois)
// =========================================================================== //

let simSpeed = 1;

let quality: number = QUALITY_NORMAL;
let isLowQuality = false;
let isHighQuality = false;

// Dimensions tenant compte de l'échelle — À UTILISER POUR LES POSITIONS DE DESSIN.
let stageW = 0;
let stageH = 0;

let currentFrame = 0;
let speedBarOpacity = 0;
let autoLaunchTime = 0;

// Fond transparent (le conteneur n'est jamais peint) : utile pour superposer les
// feux sur une page existante (ex. intégration k3ui + thème clair).
let transparentBg = false;
let trailsEnabled = true;

let paused = true;
let soundEnabled = false;

// Références installées par l'instance active.
let CONFIG: FireworksConfig;
let trailsStage: Stage;
let mainStage: Stage;
let stages: Stage[] = [];
let canvasContainer: HTMLElement;
let SND: SoundManager;
let destroyed = false;

// =========================================================================== //
//  Sélecteurs
// =========================================================================== //

const isRunning = () => !paused;
const canPlaySoundSelector = () => isRunning() && soundEnabled;
const qualitySelector = () => CONFIG.quality;
const shellNameSelector = () => CONFIG.shell;
const shellSizeSelector = () => CONFIG.size;
const finaleSelector = () => CONFIG.finale;
const skyLightingSelector = () => CONFIG.skyLighting;
const scaleFactorSelector = () => CONFIG.scaleFactor;

function configDidUpdate() {
  quality = qualitySelector();
  isLowQuality = quality === QUALITY_LOW;
  isHighQuality = quality === QUALITY_HIGH;

  if (canvasContainer) {
    if (transparentBg) {
      canvasContainer.style.backgroundColor = 'transparent';
    } else if (skyLightingSelector() === SKY_LIGHT_NONE) {
      canvasContainer.style.backgroundColor = '#000';
    }
  }

  trailsEnabled = CONFIG.trails;
  if (trailsStage?.canvas) {
    trailsStage.canvas.style.display = trailsEnabled ? '' : 'none';
  }

  Spark.drawWidth = quality === QUALITY_HIGH ? 0.75 : 1;
}

// =========================================================================== //
//  Dérivations couleur
// =========================================================================== //

const COLOR_NAMES = Object.keys(COLOR) as (keyof typeof COLOR)[];
const COLOR_CODES = COLOR_NAMES.map((name) => COLOR[name]);
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];

const COLOR_TUPLES: Record<string, { r: number; g: number; b: number }> = {};
COLOR_CODES.forEach((hex) => {
  COLOR_TUPLES[hex] = {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
});

function randomColorSimple(): string {
  return COLOR_CODES[(Math.random() * COLOR_CODES.length) | 0];
}

let lastColor: string;
function randomColor(options?: { notSame?: boolean; notColor?: string; limitWhite?: boolean }): string {
  const notSame = options && options.notSame;
  const notColor = options && options.notColor;
  const limitWhite = options && options.limitWhite;
  let color = randomColorSimple();

  if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
    color = randomColorSimple();
  }

  if (notSame) {
    while (color === lastColor) color = randomColorSimple();
  } else if (notColor) {
    while (color === notColor) color = randomColorSimple();
  }

  lastColor = color;
  return color;
}

function whiteOrGold(): string {
  return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}

function makePistilColor(shellColor: string): string {
  return shellColor === COLOR.White || shellColor === COLOR.Gold
    ? randomColor({ notColor: shellColor })
    : whiteOrGold();
}

// =========================================================================== //
//  Fabriques de tirs (types de feux) — inchangées
// =========================================================================== //

type ShellFactory = (size?: number) => any;

const crysanthemumShell: ShellFactory = (size = 1) => {
  const glitter = Math.random() < 0.25;
  const singleColor = Math.random() < 0.72;
  const color = singleColor ? randomColor({ limitWhite: true }) : [randomColor(), randomColor({ notSame: true })];
  const pistil = singleColor && Math.random() < 0.42;
  const pistilColor = pistil && makePistilColor(color as string);
  const secondColor =
    singleColor && (Math.random() < 0.2 || color === COLOR.White)
      ? pistilColor || randomColor({ notColor: color as string, limitWhite: true })
      : null;
  const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
  let starDensity = glitter ? 1.1 : 1.25;
  if (isLowQuality) starDensity *= 0.8;
  if (isHighQuality) starDensity = 1.2;
  return {
    shellSize: size,
    spreadSize: 300 + size * 100,
    starLife: 900 + size * 200,
    starDensity,
    color,
    secondColor,
    glitter: glitter ? 'light' : '',
    glitterColor: whiteOrGold(),
    pistil,
    pistilColor,
    streamers,
  };
};

const ghostShell: ShellFactory = (size = 1) => {
  const shell = crysanthemumShell(size);
  shell.starLife *= 1.5;
  const ghostColor = randomColor({ notColor: COLOR.White });
  shell.streamers = true;
  const pistil = Math.random() < 0.42;
  const pistilColor = pistil && makePistilColor(ghostColor);
  shell.color = INVISIBLE;
  shell.secondColor = ghostColor;
  shell.glitter = '';
  shell.pistil = pistil;
  shell.pistilColor = pistilColor;
  return shell;
};

const strobeShell: ShellFactory = (size = 1) => {
  const color = randomColor({ limitWhite: true });
  return {
    shellSize: size,
    spreadSize: 280 + size * 92,
    starLife: 1100 + size * 200,
    starLifeVariation: 0.4,
    starDensity: 1.1,
    color,
    glitter: 'light',
    glitterColor: COLOR.White,
    strobe: true,
    strobeColor: Math.random() < 0.5 ? COLOR.White : null,
    pistil: Math.random() < 0.5,
    pistilColor: makePistilColor(color),
  };
};

const palmShell: ShellFactory = (size = 1) => {
  const color = randomColor();
  const thick = Math.random() < 0.5;
  return {
    shellSize: size,
    color,
    spreadSize: 250 + size * 75,
    starDensity: thick ? 0.15 : 0.4,
    starLife: 1800 + size * 200,
    glitter: thick ? 'thick' : 'heavy',
  };
};

const ringShell: ShellFactory = (size = 1) => {
  const color = randomColor();
  const pistil = Math.random() < 0.75;
  return {
    shellSize: size,
    ring: true,
    color,
    spreadSize: 300 + size * 100,
    starLife: 900 + size * 200,
    starCount: 2.2 * PI_2 * (size + 1),
    pistil,
    pistilColor: makePistilColor(color),
    glitter: !pistil ? 'light' : '',
    glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
    streamers: Math.random() < 0.3,
  };
};

const crossetteShell: ShellFactory = (size = 1) => {
  const color = randomColor({ limitWhite: true });
  return {
    shellSize: size,
    spreadSize: 300 + size * 100,
    starLife: 750 + size * 160,
    starLifeVariation: 0.4,
    starDensity: 0.85,
    color,
    crossette: true,
    pistil: Math.random() < 0.5,
    pistilColor: makePistilColor(color),
  };
};

const floralShell: ShellFactory = (size = 1) => ({
  shellSize: size,
  spreadSize: 300 + size * 120,
  starDensity: 0.12,
  starLife: 500 + size * 50,
  starLifeVariation: 0.5,
  color:
    Math.random() < 0.65
      ? 'random'
      : Math.random() < 0.15
      ? randomColor()
      : [randomColor(), randomColor({ notSame: true })],
  floral: true,
});

const fallingLeavesShell: ShellFactory = (size = 1) => ({
  shellSize: size,
  color: INVISIBLE,
  spreadSize: 300 + size * 120,
  starDensity: 0.12,
  starLife: 500 + size * 50,
  starLifeVariation: 0.5,
  glitter: 'medium',
  glitterColor: COLOR.Gold,
  fallingLeaves: true,
});

const willowShell: ShellFactory = (size = 1) => ({
  shellSize: size,
  spreadSize: 300 + size * 100,
  starDensity: 0.6,
  starLife: 3000 + size * 300,
  glitter: 'willow',
  glitterColor: COLOR.Gold,
  color: INVISIBLE,
});

const crackleShell: ShellFactory = (size = 1) => {
  const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
  return {
    shellSize: size,
    spreadSize: 380 + size * 75,
    starDensity: isLowQuality ? 0.65 : 1,
    starLife: 600 + size * 100,
    starLifeVariation: 0.32,
    glitter: 'light',
    glitterColor: COLOR.Gold,
    color,
    crackle: true,
    pistil: Math.random() < 0.65,
    pistilColor: makePistilColor(color),
  };
};

const horsetailShell: ShellFactory = (size = 1) => {
  const color = randomColor();
  return {
    shellSize: size,
    horsetail: true,
    color,
    spreadSize: 250 + size * 38,
    starDensity: 0.9,
    starLife: 2500 + size * 300,
    glitter: 'medium',
    glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
    strobe: color === COLOR.White,
  };
};

function randomShellName(): ShellTypeName {
  return (Math.random() < 0.5
    ? 'Crysanthemum'
    : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0]) as ShellTypeName;
}

function randomShell(size?: number): any {
  return shellTypes[randomShellName()](size);
}

const fastShellBlacklist: ShellTypeName[] = ['Falling Leaves', 'Floral', 'Willow'];
function randomFastShell(): ShellFactory {
  const isRandom = shellNameSelector() === 'Random';
  let shellName = isRandom ? randomShellName() : shellNameSelector();
  if (isRandom) {
    while (fastShellBlacklist.includes(shellName)) shellName = randomShellName();
  }
  return shellTypes[shellName];
}

const shellTypes: Record<ShellTypeName, ShellFactory> = {
  Random: randomShell,
  Crackle: crackleShell,
  Crossette: crossetteShell,
  Crysanthemum: crysanthemumShell,
  'Falling Leaves': fallingLeavesShell,
  Floral: floralShell,
  Ghost: ghostShell,
  'Horse Tail': horsetailShell,
  Palm: palmShell,
  Ring: ringShell,
  Strobe: strobeShell,
  Willow: willowShell,
};

const shellNames = Object.keys(shellTypes) as ShellTypeName[];

// =========================================================================== //
//  Positionnement des tirs
// =========================================================================== //

function fitShellPositionInBoundsH(position: number): number {
  const edge = 0.18;
  return (1 - edge * 2) * position + edge;
}
function fitShellPositionInBoundsV(position: number): number {
  return position * 0.75;
}
function getRandomShellPositionH(): number {
  return fitShellPositionInBoundsH(Math.random());
}
function getRandomShellPositionV(): number {
  return fitShellPositionInBoundsV(Math.random());
}
function getRandomShellSize() {
  const baseSize = shellSizeSelector();
  const maxVariance = Math.min(2.5, baseSize);
  const variance = Math.random() * maxVariance;
  const size = baseSize - variance;
  const height = maxVariance === 0 ? Math.random() : 1 - variance / maxVariance;
  const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
  const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;
  return { size, x: fitShellPositionInBoundsH(x), height: fitShellPositionInBoundsV(height) };
}

// =========================================================================== //
//  Séquences aléatoires intégrées (pour le mode autoLaunch)
// =========================================================================== //

function seqRandomShell(): number {
  const size = getRandomShellSize();
  const shell = new Shell(shellTypes[shellNameSelector()](size.size));
  shell.launch(size.x, size.height);
  let extraDelay = shell.starLife;
  if (shell.fallingLeaves) extraDelay = 4600;
  return 900 + Math.random() * 600 + extraDelay;
}

function seqTwoRandom(): number {
  const size1 = getRandomShellSize();
  const size2 = getRandomShellSize();
  const shell1 = new Shell(shellTypes[shellNameSelector()](size1.size));
  const shell2 = new Shell(shellTypes[shellNameSelector()](size2.size));
  const leftOffset = Math.random() * 0.2 - 0.1;
  const rightOffset = Math.random() * 0.2 - 0.1;
  shell1.launch(0.3 + leftOffset, size1.height);
  setTimeout(() => {
    if (!destroyed) shell2.launch(0.7 + rightOffset, size2.height);
  }, 100);
  let extraDelay = Math.max(shell1.starLife, shell2.starLife);
  if (shell1.fallingLeaves || shell2.fallingLeaves) extraDelay = 4600;
  return 900 + Math.random() * 600 + extraDelay;
}

function seqTriple(): number {
  const shellType = randomFastShell();
  const baseSize = shellSizeSelector();
  const smallSize = Math.max(0, baseSize - 1.25);
  const offset = Math.random() * 0.08 - 0.04;
  const shell1 = new Shell(shellType(baseSize));
  shell1.launch(0.5 + offset, 0.7);
  const leftDelay = 1000 + Math.random() * 400;
  const rightDelay = 1000 + Math.random() * 400;
  setTimeout(() => {
    if (destroyed) return;
    const o = Math.random() * 0.08 - 0.04;
    new Shell(shellType(smallSize)).launch(0.2 + o, 0.1);
  }, leftDelay);
  setTimeout(() => {
    if (destroyed) return;
    const o = Math.random() * 0.08 - 0.04;
    new Shell(shellType(smallSize)).launch(0.8 + o, 0.1);
  }, rightDelay);
  return 4000;
}

function seqPyramid(): number {
  const barrageCountHalf = IS_DESKTOP ? 7 : 4;
  const largeSize = shellSizeSelector();
  const smallSize = Math.max(0, largeSize - 3);
  const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;

  function launchShell(x: number, useSpecial: boolean) {
    const isRandom = shellNameSelector() === 'Random';
    const shellType = isRandom ? (useSpecial ? randomShell : randomMainShell) : shellTypes[shellNameSelector()];
    const shell = new Shell(shellType(useSpecial ? largeSize : smallSize));
    const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5;
    shell.launch(x, useSpecial ? 0.75 : height * 0.42);
  }

  let count = 0;
  let delay = 0;
  while (count <= barrageCountHalf) {
    if (count === barrageCountHalf) {
      setTimeout(() => !destroyed && launchShell(0.5, true), delay);
    } else {
      const offset = (count / barrageCountHalf) * 0.5;
      const delayOffset = Math.random() * 30 + 30;
      setTimeout(() => !destroyed && launchShell(offset, false), delay);
      setTimeout(() => !destroyed && launchShell(1 - offset, false), delay + delayOffset);
    }
    count++;
    delay += 200;
  }
  return 3400 + barrageCountHalf * 250;
}

function seqSmallBarrage(): number {
  seqSmallBarrage.lastCalled = Date.now();
  const barrageCount = IS_DESKTOP ? 11 : 5;
  const specialIndex = IS_DESKTOP ? 3 : 1;
  const shellSize = Math.max(0, shellSizeSelector() - 2);
  const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
  const randomSpecialShell = randomFastShell();

  function launchShell(x: number, useSpecial: boolean) {
    const isRandom = shellNameSelector() === 'Random';
    const shellType = isRandom
      ? useSpecial
        ? randomSpecialShell
        : randomMainShell
      : shellTypes[shellNameSelector()];
    const shell = new Shell(shellType(shellSize));
    const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2;
    shell.launch(x, height * 0.75);
  }

  let count = 0;
  let delay = 0;
  while (count < barrageCount) {
    if (count === 0) {
      launchShell(0.5, false);
      count += 1;
    } else {
      const offset = (count + 1) / barrageCount / 2;
      const delayOffset = Math.random() * 30 + 30;
      const useSpecial = count === specialIndex;
      setTimeout(() => !destroyed && launchShell(0.5 + offset, useSpecial), delay);
      setTimeout(() => !destroyed && launchShell(0.5 - offset, useSpecial), delay + delayOffset);
      count += 2;
    }
    delay += 200;
  }
  return 3400 + barrageCount * 120;
}
seqSmallBarrage.cooldown = 15000;
seqSmallBarrage.lastCalled = Date.now();

let isFirstSeq = true;
const finaleCount = 32;
let currentFinaleCount = 0;

function startSequence(): number {
  if (isFirstSeq) {
    isFirstSeq = false;
    const shell = new Shell(crysanthemumShell(shellSizeSelector()));
    shell.launch(0.5, 0.5);
    return 2400;
  }

  if (finaleSelector()) {
    launchOneFast();
    if (currentFinaleCount < finaleCount) {
      currentFinaleCount++;
      return 170;
    }
    currentFinaleCount = 0;
    return 6000;
  }

  const rand = Math.random();
  if (rand < 0.08 && Date.now() - seqSmallBarrage.lastCalled > seqSmallBarrage.cooldown) return seqSmallBarrage();
  if (rand < 0.1) return seqPyramid();
  if (rand < 0.6) return seqRandomShell();
  if (rand < 0.8) return seqTwoRandom();
  return seqTriple();
}

// =========================================================================== //
//  Ordonnanceur de séquences PERSONNALISÉES (cadencé sur l'horloge de simu)
// =========================================================================== //

interface InternalStep {
  action: () => void;
  delay: number;
}

let seqSteps: InternalStep[] | null = null;
let seqIndex = 0;
let seqTimer = 0;
let seqLoop = false;
let seqOnEnd: (() => void) | null = null;

/** Tire N obus étalés horizontalement (une salve « lance N »). */
function launchBurst(count: number, override?: { shell?: ShellTypeName; size?: number }) {
  for (let i = 0; i < count; i++) {
    const info = getRandomShellSize();
    const sizeVal = override && override.size != null ? override.size : info.size;
    const factory = shellTypes[(override && override.shell) || CONFIG.shell];
    const shell = new Shell(factory(sizeVal));
    let x: number;
    let height: number;
    if (count === 1) {
      x = getRandomShellPositionH();
      height = getRandomShellPositionV();
    } else {
      const base = 0.15 + 0.7 * (i / (count - 1));
      x = MyMath.clamp(base + (Math.random() * 0.1 - 0.05), 0.08, 0.92);
      height = fitShellPositionInBoundsV(0.55 + Math.random() * 0.4);
    }
    shell.launch(x, height);
  }
}

/** Tire un unique obus « rapide » (utilisé pour les bouquets finaux). */
function launchOneFast(shell?: ShellTypeName, size?: number) {
  const info = getRandomShellSize();
  const sizeVal = size != null ? size : info.size;
  const factory = shell ? shellTypes[shell] : randomFastShell();
  new Shell(factory(sizeVal)).launch(getRandomShellPositionH(), getRandomShellPositionV());
}

function compileSequence(salvos: SequenceSalvo[]): InternalStep[] {
  const steps: InternalStep[] = [];
  for (const salvo of salvos) {
    if (salvo.finale) {
      const n = salvo.finaleCount != null ? salvo.finaleCount : 24;
      for (let i = 0; i < n; i++) {
        steps.push({
          action: () => launchOneFast(salvo.shell, salvo.size),
          delay: salvo.delay != null ? salvo.delay : 110 + Math.random() * 70,
        });
      }
      // Laisser le bouquet éclore et s'estomper avant la suite / la boucle.
      steps.push({ action: () => {}, delay: 5200 });
    } else if (salvo.wait != null) {
      steps.push({ action: () => {}, delay: salvo.wait });
    } else {
      const count = salvo.count != null ? salvo.count : 1;
      steps.push({
        action: () => launchBurst(count, { shell: salvo.shell, size: salvo.size }),
        delay: salvo.delay != null ? salvo.delay : 2400 + count * 150 + Math.random() * 500,
      });
    }
  }
  return steps;
}

function advanceSequence() {
  if (!seqSteps) return;
  if (seqIndex >= seqSteps.length) {
    if (seqLoop) {
      seqIndex = 0;
    } else {
      const cb = seqOnEnd;
      seqSteps = null;
      seqOnEnd = null;
      if (cb) cb();
      return;
    }
  }
  const step = seqSteps[seqIndex++];
  step.action();
  seqTimer = step.delay;
}

// =========================================================================== //
//  Boucle de mise à jour & rendu (portées du script d'origine)
// =========================================================================== //

function updateGlobals(timeStep: number, lag: number) {
  currentFrame++;

  if (!false) {
    speedBarOpacity -= lag / 30;
    if (speedBarOpacity < 0) speedBarOpacity = 0;
  }

  // Séquence personnalisée prioritaire, sinon tir auto.
  if (seqSteps) {
    seqTimer -= timeStep;
    if (seqTimer <= 0) advanceSequence();
  } else if (CONFIG.autoLaunch) {
    autoLaunchTime -= timeStep;
    if (autoLaunchTime <= 0) autoLaunchTime = startSequence() * 1.25;
  }
}

function update(frameTime: number, lag: number) {
  if (!isRunning()) return;

  const timeStep = frameTime * simSpeed;
  const speed = simSpeed * lag;

  updateGlobals(timeStep, lag);

  const starDrag = 1 - (1 - Star.airDrag) * speed;
  const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
  const sparkDrag = 1 - (1 - Spark.airDrag) * speed;
  const gAcc = (timeStep / 1000) * GRAVITY;

  COLOR_CODES_W_INVIS.forEach((color) => {
    const stars = Star.active[color];
    for (let i = stars.length - 1; i >= 0; i = i - 1) {
      const star = stars[i];
      if (star.updateFrame === currentFrame) continue;
      star.updateFrame = currentFrame;

      star.life -= timeStep;
      if (star.life <= 0) {
        stars.splice(i, 1);
        Star.returnInstance(star);
      } else {
        const burnRate = Math.pow(star.life / star.fullLife, 0.5);
        const burnRateInverse = 1 - burnRate;

        star.prevX = star.x;
        star.prevY = star.y;
        star.x += star.speedX * speed;
        star.y += star.speedY * speed;
        if (!star.heavy) {
          star.speedX *= starDrag;
          star.speedY *= starDrag;
        } else {
          star.speedX *= starDragHeavy;
          star.speedY *= starDragHeavy;
        }
        star.speedY += gAcc;

        if (star.spinRadius) {
          star.spinAngle += star.spinSpeed * speed;
          star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
          star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
        }

        if (star.sparkFreq) {
          star.sparkTimer -= timeStep;
          while (star.sparkTimer < 0) {
            star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
            Spark.add(
              star.x,
              star.y,
              star.sparkColor,
              Math.random() * PI_2,
              Math.random() * star.sparkSpeed * burnRate,
              star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife
            );
          }
        }

        if (star.life < star.transitionTime) {
          if (star.secondColor && !star.colorChanged) {
            star.colorChanged = true;
            star.color = star.secondColor;
            stars.splice(i, 1);
            Star.active[star.secondColor].push(star);
            if (star.secondColor === INVISIBLE) star.sparkFreq = 0;
          }
          if (star.strobe) {
            star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
          }
        }
      }
    }

    const sparks = Spark.active[color];
    for (let i = sparks.length - 1; i >= 0; i = i - 1) {
      const spark = sparks[i];
      spark.life -= timeStep;
      if (spark.life <= 0) {
        sparks.splice(i, 1);
        Spark.returnInstance(spark);
      } else {
        spark.prevX = spark.x;
        spark.prevY = spark.y;
        spark.x += spark.speedX * speed;
        spark.y += spark.speedY * speed;
        spark.speedX *= sparkDrag;
        spark.speedY *= sparkDrag;
        spark.speedY += gAcc;
      }
    }
  });

  render(speed);
}

/** Nombre de particules actives (étoiles, étincelles, flashs). */
function getActiveParticleCount(): number {
  let n = BurstFlash.active.length;
  for (const c of COLOR_CODES_W_INVIS) {
    n += Star.active[c].length + Spark.active[c].length;
  }
  return n;
}

/** true si aucun tir ni séquence en cours. */
function isFireworksVisuallyIdle(): boolean {
  return !seqSteps && !CONFIG.autoLaunch && getActiveParticleCount() === 0;
}

/**
 * Réinitialise les canvas en mode fond transparent.
 * @param force - true pour forcer le nettoyage (ex. restauration de thème)
 */
function resetTransparentIdleCanvases(force = false): void {
  if (!transparentBg || !trailsStage || !mainStage) return;
  if (!force && !isFireworksVisuallyIdle()) return;

  const trailsCtx = trailsStage.ctx;
  const mainCtx = mainStage.ctx;

  trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  trailsCtx.clearRect(0, 0, trailsStage.canvas.width, trailsStage.canvas.height);
  mainCtx.clearRect(0, 0, mainStage.canvas.width, mainStage.canvas.height);

  if (canvasContainer) {
    canvasContainer.style.backgroundColor = 'transparent';
  }
}

function render(speed: number) {
  if (transparentBg && isFireworksVisuallyIdle()) {
    resetTransparentIdleCanvases();
    return;
  }

  const dpr = mainStage.dpr;
  const width = stageW;
  const height = stageH;
  const trailsCtx = trailsStage.ctx;
  const mainCtx = mainStage.ctx;
  const drawTrails = trailsEnabled;

  if (skyLightingSelector() !== SKY_LIGHT_NONE) colorSky(speed);

  const scaleFactor = scaleFactorSelector();
  mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor);

  if (drawTrails) {
    trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor);
    const shouldAccumulateImprints =
      CONFIG.imprints && getActiveParticleCount() > 0;
    if (shouldAccumulateImprints) {
      const trailFadeAlpha = CONFIG.longExposure ? 0.0025 : 0.175 * speed;
      if (transparentBg) {
        trailsCtx.globalCompositeOperation = 'destination-out';
        trailsCtx.fillStyle = `rgba(0, 0, 0, ${trailFadeAlpha})`;
        trailsCtx.fillRect(0, 0, width, height);
        trailsCtx.globalCompositeOperation = 'source-over';
      } else {
        trailsCtx.globalCompositeOperation = 'source-over';
        trailsCtx.fillStyle = `rgba(0, 0, 0, ${trailFadeAlpha})`;
        trailsCtx.fillRect(0, 0, width, height);
      }
    } else {
      trailsCtx.clearRect(0, 0, width, height);
    }
  } else {
    trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
    trailsCtx.clearRect(0, 0, trailsStage.canvas.width, trailsStage.canvas.height);
  }

  mainCtx.clearRect(0, 0, width, height);

  const flashCtx = drawTrails ? trailsCtx : mainCtx;
  while (BurstFlash.active.length) {
    const bf = BurstFlash.active.pop();
    const g = flashCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
    g.addColorStop(0.024, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)');
    g.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)');
    g.addColorStop(1, 'rgba(255, 120, 20, 0)');
    flashCtx.fillStyle = g;
    flashCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);
    BurstFlash.returnInstance(bf);
  }

  if (drawTrails) {
    trailsCtx.globalCompositeOperation = 'lighten';

    trailsCtx.lineWidth = Star.drawWidth;
    trailsCtx.lineCap = isLowQuality ? 'square' : 'round';
    COLOR_CODES.forEach((color) => {
      const stars = Star.active[color];
      trailsCtx.strokeStyle = color;
      trailsCtx.beginPath();
      stars.forEach((star: any) => {
        if (star.visible) {
          trailsCtx.moveTo(star.x, star.y);
          trailsCtx.lineTo(star.prevX, star.prevY);
        }
      });
      trailsCtx.stroke();
    });

    trailsCtx.lineWidth = Spark.drawWidth;
    trailsCtx.lineCap = 'butt';
    COLOR_CODES.forEach((color) => {
      const sparks = Spark.active[color];
      trailsCtx.strokeStyle = color;
      trailsCtx.beginPath();
      sparks.forEach((spark: any) => {
        trailsCtx.moveTo(spark.x, spark.y);
        trailsCtx.lineTo(spark.prevX, spark.prevY);
      });
      trailsCtx.stroke();
    });
  }

  mainCtx.strokeStyle = '#fff';
  mainCtx.lineWidth = 1;
  mainCtx.beginPath();
  COLOR_CODES.forEach((color) => {
    const stars = Star.active[color];
    stars.forEach((star: any) => {
      if (star.visible) {
        mainCtx.moveTo(star.x, star.y);
        mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
      }
    });
  });
  mainCtx.stroke();

  if (speedBarOpacity) {
    const speedBarHeight = 6;
    mainCtx.globalAlpha = speedBarOpacity;
    mainCtx.fillStyle = COLOR.Blue;
    mainCtx.fillRect(0, height - speedBarHeight, width * simSpeed, speedBarHeight);
    mainCtx.globalAlpha = 1;
  }

  trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
}

const currentSkyColor = { r: 0, g: 0, b: 0 };
const targetSkyColor = { r: 0, g: 0, b: 0 };
function colorSky(speed: number) {
  if (transparentBg) return; // fond transparent : on ne peint jamais le conteneur
  const maxSkySaturation = skyLightingSelector() * 15;
  const maxStarCount = 500;
  let totalStarCount = 0;
  targetSkyColor.r = 0;
  targetSkyColor.g = 0;
  targetSkyColor.b = 0;
  COLOR_CODES.forEach((color) => {
    const tuple = COLOR_TUPLES[color];
    const count = Star.active[color].length;
    totalStarCount += count;
    targetSkyColor.r += tuple.r * count;
    targetSkyColor.g += tuple.g * count;
    targetSkyColor.b += tuple.b * count;
  });

  const intensity = Math.pow(Math.min(1, totalStarCount / maxStarCount), 0.3);
  const maxColorComponent = Math.max(1, targetSkyColor.r, targetSkyColor.g, targetSkyColor.b);
  targetSkyColor.r = (targetSkyColor.r / maxColorComponent) * maxSkySaturation * intensity;
  targetSkyColor.g = (targetSkyColor.g / maxColorComponent) * maxSkySaturation * intensity;
  targetSkyColor.b = (targetSkyColor.b / maxColorComponent) * maxSkySaturation * intensity;

  const colorChange = 10;
  currentSkyColor.r += ((targetSkyColor.r - currentSkyColor.r) / colorChange) * speed;
  currentSkyColor.g += ((targetSkyColor.g - currentSkyColor.g) / colorChange) * speed;
  currentSkyColor.b += ((targetSkyColor.b - currentSkyColor.b) / colorChange) * speed;

  canvasContainer.style.backgroundColor = `rgb(${currentSkyColor.r | 0}, ${currentSkyColor.g | 0}, ${
    currentSkyColor.b | 0
  })`;
}

// =========================================================================== //
//  Effets de mort d'étoile (inchangés)
// =========================================================================== //

function createParticleArc(
  start: number,
  arcLength: number,
  count: number,
  randomness: number,
  particleFactory: (angle: number) => void
) {
  const angleDelta = arcLength / count;
  const end = start + arcLength - angleDelta * 0.5;
  if (end > start) {
    for (let angle = start; angle < end; angle = angle + angleDelta) {
      particleFactory(angle + Math.random() * angleDelta * randomness);
    }
  } else {
    for (let angle = start; angle > end; angle = angle + angleDelta) {
      particleFactory(angle + Math.random() * angleDelta * randomness);
    }
  }
}

function createBurst(
  count: number,
  particleFactory: (angle: number, speedMult: number) => void,
  startAngle = 0,
  arcLength = PI_2
) {
  const R = 0.5 * Math.sqrt(count / Math.PI);
  const C = 2 * R * Math.PI;
  const C_HALF = C / 2;
  for (let i = 0; i <= C_HALF; i++) {
    const ringAngle = (i / C_HALF) * PI_HALF;
    const ringSize = Math.cos(ringAngle);
    const partsPerFullRing = C * ringSize;
    const partsPerArc = partsPerFullRing * (arcLength / PI_2);
    const angleInc = PI_2 / partsPerFullRing;
    const angleOffset = Math.random() * angleInc + startAngle;
    const maxRandomAngleOffset = angleInc * 0.33;
    for (let j = 0; j < partsPerArc; j++) {
      const randomAngleOffset = Math.random() * maxRandomAngleOffset;
      const angle = angleInc * j + angleOffset + randomAngleOffset;
      particleFactory(angle, ringSize);
    }
  }
}

function crossetteEffect(star: any) {
  const startAngle = Math.random() * PI_HALF;
  createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
    Star.add(star.x, star.y, star.color, angle, Math.random() * 0.6 + 0.75, 600);
  });
}

function floralEffect(star: any) {
  const count = 12 + 6 * quality;
  createBurst(count, (angle, speedMult) => {
    Star.add(star.x, star.y, star.color, angle, speedMult * 2.4, 1000 + Math.random() * 300, star.speedX, star.speedY);
  });
  BurstFlash.add(star.x, star.y, 46);
  SND.playSound('burstSmall');
}

function fallingLeavesEffect(star: any) {
  createBurst(7, (angle, speedMult) => {
    const newStar = Star.add(
      star.x,
      star.y,
      INVISIBLE,
      angle,
      speedMult * 2.4,
      2400 + Math.random() * 600,
      star.speedX,
      star.speedY
    );
    newStar.sparkColor = COLOR.Gold;
    newStar.sparkFreq = 144 / quality;
    newStar.sparkSpeed = 0.28;
    newStar.sparkLife = 750;
    newStar.sparkLifeVariation = 3.2;
  });
  BurstFlash.add(star.x, star.y, 46);
  SND.playSound('burstSmall');
}

function crackleEffect(star: any) {
  const count = isHighQuality ? 32 : 16;
  createParticleArc(0, PI_2, count, 1.8, (angle) => {
    Spark.add(star.x, star.y, COLOR.Gold, angle, Math.pow(Math.random(), 0.45) * 2.4, 300 + Math.random() * 200);
  });
}

// =========================================================================== //
//  Shell (obus) — inchangé
// =========================================================================== //

class Shell {
  [key: string]: any;

  constructor(options: any) {
    Object.assign(this, options);
    this.starLifeVariation = options.starLifeVariation || 0.125;
    this.color = options.color || randomColor();
    this.glitterColor = options.glitterColor || this.color;
    if (!this.starCount) {
      const density = options.starDensity || 1;
      const scaledSize = this.spreadSize / 54;
      this.starCount = Math.max(6, scaledSize * scaledSize * density);
    }
  }

  launch(position: number, launchHeight: number) {
    const width = stageW;
    const height = stageH;
    const hpad = 60;
    const vpad = 50;
    const minHeightPercent = 0.45;
    const minHeight = height - height * minHeightPercent;

    const launchX = position * (width - hpad * 2) + hpad;
    const launchY = height;
    const burstY = minHeight - launchHeight * (minHeight - vpad);

    const launchDistance = launchY - burstY;
    const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);

    const comet = (this.comet = Star.add(
      launchX,
      launchY,
      typeof this.color === 'string' && this.color !== 'random' ? this.color : COLOR.White,
      Math.PI,
      launchVelocity * (this.horsetail ? 1.2 : 1),
      launchVelocity * (this.horsetail ? 100 : 400)
    ));

    comet.heavy = true;
    comet.spinRadius = MyMath.random(0.32, 0.85);
    comet.sparkFreq = 32 / quality;
    if (isHighQuality) comet.sparkFreq = 8;
    comet.sparkLife = 320;
    comet.sparkLifeVariation = 3;
    if (this.glitter === 'willow' || this.fallingLeaves) {
      comet.sparkFreq = 20 / quality;
      comet.sparkSpeed = 0.5;
      comet.sparkLife = 500;
    }
    if (this.color === INVISIBLE) comet.sparkColor = COLOR.Gold;

    if (Math.random() > 0.4 && !this.horsetail) {
      comet.secondColor = INVISIBLE;
      comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
    }

    comet.onDeath = (c: any) => this.burst(c.x, c.y);

    SND.playSound('lift');
  }

  burst(x: number, y: number) {
    const speed = this.spreadSize / 96;

    let color: any;
    let onDeath: ((star: any) => void) | undefined;
    let sparkFreq = 0;
    let sparkSpeed = 0;
    let sparkLife = 0;
    let sparkLifeVariation = 0.25;
    let playedDeathSound = false;

    if (this.crossette)
      onDeath = (star) => {
        if (!playedDeathSound) {
          SND.playSound('crackleSmall');
          playedDeathSound = true;
        }
        crossetteEffect(star);
      };
    if (this.crackle)
      onDeath = (star) => {
        if (!playedDeathSound) {
          SND.playSound('crackle');
          playedDeathSound = true;
        }
        crackleEffect(star);
      };
    if (this.floral) onDeath = floralEffect;
    if (this.fallingLeaves) onDeath = fallingLeavesEffect;

    if (this.glitter === 'light') {
      sparkFreq = 400;
      sparkSpeed = 0.3;
      sparkLife = 300;
      sparkLifeVariation = 2;
    } else if (this.glitter === 'medium') {
      sparkFreq = 200;
      sparkSpeed = 0.44;
      sparkLife = 700;
      sparkLifeVariation = 2;
    } else if (this.glitter === 'heavy') {
      sparkFreq = 80;
      sparkSpeed = 0.8;
      sparkLife = 1400;
      sparkLifeVariation = 2;
    } else if (this.glitter === 'thick') {
      sparkFreq = 16;
      sparkSpeed = isHighQuality ? 1.65 : 1.5;
      sparkLife = 1400;
      sparkLifeVariation = 3;
    } else if (this.glitter === 'streamer') {
      sparkFreq = 32;
      sparkSpeed = 1.05;
      sparkLife = 620;
      sparkLifeVariation = 2;
    } else if (this.glitter === 'willow') {
      sparkFreq = 120;
      sparkSpeed = 0.34;
      sparkLife = 1400;
      sparkLifeVariation = 3.8;
    }

    sparkFreq = sparkFreq / quality;

    const starFactory = (angle: number, speedMult: number) => {
      const standardInitialSpeed = this.spreadSize / 1800;
      const star = Star.add(
        x,
        y,
        color || randomColor(),
        angle,
        speedMult * speed,
        this.starLife + Math.random() * this.starLife * this.starLifeVariation,
        this.horsetail ? this.comet && this.comet.speedX : 0,
        this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed
      );

      if (this.secondColor) {
        star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32);
        star.secondColor = this.secondColor;
      }

      if (this.strobe) {
        star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46);
        star.strobe = true;
        star.strobeFreq = Math.random() * 20 + 40;
        if (this.strobeColor) star.secondColor = this.strobeColor;
      }

      star.onDeath = onDeath;

      if (this.glitter) {
        star.sparkFreq = sparkFreq;
        star.sparkSpeed = sparkSpeed;
        star.sparkLife = sparkLife;
        star.sparkLifeVariation = sparkLifeVariation;
        star.sparkColor = this.glitterColor;
        star.sparkTimer = Math.random() * star.sparkFreq;
      }
    };

    if (typeof this.color === 'string') {
      if (this.color === 'random') color = null;
      else color = this.color;

      if (this.ring) {
        const ringStartAngle = Math.random() * Math.PI;
        const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15;
        createParticleArc(0, PI_2, this.starCount, 0, (angle) => {
          const initSpeedX = Math.sin(angle) * speed * ringSquash;
          const initSpeedY = Math.cos(angle) * speed;
          const newSpeed = MyMath.pointDist(0, 0, initSpeedX, initSpeedY);
          const newAngle = MyMath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle;
          const star = Star.add(
            x,
            y,
            color,
            newAngle,
            newSpeed,
            this.starLife + Math.random() * this.starLife * this.starLifeVariation
          );
          if (this.glitter) {
            star.sparkFreq = sparkFreq;
            star.sparkSpeed = sparkSpeed;
            star.sparkLife = sparkLife;
            star.sparkLifeVariation = sparkLifeVariation;
            star.sparkColor = this.glitterColor;
            star.sparkTimer = Math.random() * star.sparkFreq;
          }
        });
      } else {
        createBurst(this.starCount, starFactory);
      }
    } else if (Array.isArray(this.color)) {
      if (Math.random() < 0.5) {
        const start = Math.random() * Math.PI;
        const start2 = start + Math.PI;
        const arc = Math.PI;
        color = this.color[0];
        createBurst(this.starCount, starFactory, start, arc);
        color = this.color[1];
        createBurst(this.starCount, starFactory, start2, arc);
      } else {
        color = this.color[0];
        createBurst(this.starCount / 2, starFactory);
        color = this.color[1];
        createBurst(this.starCount / 2, starFactory);
      }
    } else {
      throw new Error('Invalid shell color. Expected string or array of strings, but got: ' + this.color);
    }

    if (this.pistil) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.5,
        starLife: this.starLife * 0.6,
        starLifeVariation: this.starLifeVariation,
        starDensity: 1.4,
        color: this.pistilColor,
        glitter: 'light',
        glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White,
      });
      innerShell.burst(x, y);
    }

    if (this.streamers) {
      const innerShell = new Shell({
        spreadSize: this.spreadSize * 0.9,
        starLife: this.starLife * 0.8,
        starLifeVariation: this.starLifeVariation,
        starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
        color: COLOR.White,
        glitter: 'streamer',
      });
      innerShell.burst(x, y);
    }

    BurstFlash.add(x, y, this.spreadSize / 4);

    if (this.comet) {
      const maxDiff = 2;
      const sizeDifferenceFromMaxSize = Math.min(maxDiff, shellSizeSelector() - this.shellSize);
      const soundScale = (1 - sizeDifferenceFromMaxSize / maxDiff) * 0.3 + 0.7;
      SND.playSound('burst', soundScale);
    }
  }
}

// =========================================================================== //
//  Pools de particules (inchangés)
// =========================================================================== //

const BurstFlash = {
  active: [] as any[],
  _pool: [] as any[],
  _new() {
    return {};
  },
  add(x: number, y: number, radius: number) {
    const instance: any = this._pool.pop() || this._new();
    instance.x = x;
    instance.y = y;
    instance.radius = radius;
    this.active.push(instance);
    return instance;
  },
  returnInstance(instance: any) {
    this._pool.push(instance);
  },
};

function createParticleCollection(): Record<string, any[]> {
  const collection: Record<string, any[]> = {};
  COLOR_CODES_W_INVIS.forEach((color) => {
    collection[color] = [];
  });
  return collection;
}

const Star = {
  drawWidth: 3,
  airDrag: 0.98,
  airDragHeavy: 0.992,
  active: createParticleCollection(),
  _pool: [] as any[],
  _new() {
    return {};
  },
  add(
    x: number,
    y: number,
    color: string,
    angle: number,
    speed: number,
    life: number,
    speedOffX?: number,
    speedOffY?: number
  ): any {
    const instance: any = this._pool.pop() || this._new();
    instance.visible = true;
    instance.heavy = false;
    instance.x = x;
    instance.y = y;
    instance.prevX = x;
    instance.prevY = y;
    instance.color = color;
    instance.speedX = Math.sin(angle) * speed + (speedOffX || 0);
    instance.speedY = Math.cos(angle) * speed + (speedOffY || 0);
    instance.life = life;
    instance.fullLife = life;
    instance.spinAngle = Math.random() * PI_2;
    instance.spinSpeed = 0.8;
    instance.spinRadius = 0;
    instance.sparkFreq = 0;
    instance.sparkSpeed = 1;
    instance.sparkTimer = 0;
    instance.sparkColor = color;
    instance.sparkLife = 750;
    instance.sparkLifeVariation = 0.25;
    instance.strobe = false;
    this.active[color].push(instance);
    return instance;
  },
  returnInstance(instance: any) {
    instance.onDeath && instance.onDeath(instance);
    instance.onDeath = null;
    instance.secondColor = null;
    instance.transitionTime = 0;
    instance.colorChanged = false;
    this._pool.push(instance);
  },
};

const Spark = {
  drawWidth: 0,
  airDrag: 0.9,
  active: createParticleCollection(),
  _pool: [] as any[],
  _new() {
    return {};
  },
  add(x: number, y: number, color: string, angle: number, speed: number, life: number): any {
    const instance: any = this._pool.pop() || this._new();
    instance.x = x;
    instance.y = y;
    instance.prevX = x;
    instance.prevY = y;
    instance.color = color;
    instance.speedX = Math.sin(angle) * speed;
    instance.speedY = Math.cos(angle) * speed;
    instance.life = life;
    this.active[color].push(instance);
    return instance;
  },
  returnInstance(instance: any) {
    this._pool.push(instance);
  },
};

// =========================================================================== //
//  Stage minimal (remplace la lib `Stage` de CodePen)
// =========================================================================== //

class Stage {
  static disableHighDPI = false;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    this.dpr = Stage.disableHighDPI ? 1 : window.devicePixelRatio || 1;
  }

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }
}

// =========================================================================== //
//  Gestionnaire de sons (Web Audio) — inchangé, chargé à la demande
// =========================================================================== //

class SoundManager {
  baseURL: string;
  mode: SoundMode;
  customUrls: Partial<Record<string, string[]>> | null = null;
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  loaded = false;
  loading: Promise<any> | null = null;
  _lastSmallBurstTime = 0;

  // volume = niveau de base ; playbackRate* = plage de « pitch » (réutilisée par
  // la synthèse) ; fileNames = échantillons d'origine (mode 'samples').
  sources: Record<string, any> = {
    lift: { volume: 1, playbackRateMin: 0.85, playbackRateMax: 0.95, fileNames: ['lift1.mp3', 'lift2.mp3', 'lift3.mp3'] },
    burst: { volume: 1, playbackRateMin: 0.8, playbackRateMax: 0.9, fileNames: ['burst1.mp3', 'burst2.mp3'] },
    burstSmall: { volume: 0.25, playbackRateMin: 0.8, playbackRateMax: 1, fileNames: ['burst-sm-1.mp3', 'burst-sm-2.mp3'] },
    crackle: { volume: 0.2, playbackRateMin: 1, playbackRateMax: 1, fileNames: ['crackle1.mp3'] },
    crackleSmall: { volume: 0.3, playbackRateMin: 1, playbackRateMax: 1, fileNames: ['crackle-sm-1.mp3'] },
  };

  constructor(baseURL: string, mode: SoundMode = 'synth', customUrls?: Partial<Record<string, string[]>> | null) {
    this.baseURL = baseURL;
    this.mode = mode;
    this.customUrls = customUrls || null;
  }

  private ensureCtx() {
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx!.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx!.destination);
      // Tampon de bruit blanc partagé, base de toute la synthèse.
      const len = (this.ctx!.sampleRate * 1) | 0;
      const buf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.ctx as AudioContext;
  }

  preload(): Promise<any> {
    if (this.loading) return this.loading;
    this.ensureCtx();

    // Mode synthèse : rien à télécharger, prêt immédiatement.
    if (this.mode === 'synth') {
      this.loaded = true;
      this.loading = Promise.resolve();
      return this.loading;
    }

    // Mode 'samples' : on charge les échantillons. Chaque son devient jouable
    // dès qu'il est prêt (pas d'attente « tout ou rien ») ; un fichier en échec
    // n'empêche pas les autres de jouer.
    this.loaded = true;
    const loadType = (type: string): Promise<any> => {
      const source = this.sources[type];
      const urls: string[] =
        (this.customUrls && this.customUrls[type]) ||
        source.fileNames.map((fn: string) => this.baseURL + fn);
      return Promise.all(urls.map((u) => this.loadClip(u)))
        .then((buffers) => {
          source.buffers = buffers.filter(Boolean) as AudioBuffer[];
        })
        .catch(() => {});
    };
    this.loading = Promise.all(Object.keys(this.sources).map(loadType));
    return this.loading;
  }

  /** Charge et décode un clip (URL ou data-URI). Ne rejette jamais (null en cas d'échec). */
  private loadClip(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ensureCtx();
    const getBytes = (): Promise<ArrayBuffer> => {
      if (url.slice(0, 5) === 'data:') {
        // Décodage base64 direct : aucun fetch → fiable en file:// et hors-ligne.
        const comma = url.indexOf(',');
        const bin = atob(url.slice(comma + 1));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return Promise.resolve(bytes.buffer);
      }
      return fetch(url).then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.arrayBuffer();
      });
    };
    return getBytes()
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) => {
            // decodeAudioData : gère la forme Promise ET la forme callback.
            let p: any;
            try {
              p = ctx.decodeAudioData(data, resolve, reject);
            } catch (e) {
              reject(e);
              return;
            }
            if (p && typeof p.then === 'function') p.then(resolve, reject);
          }),
      )
      .catch(() => null);
  }

  pauseAll() {
    if (this.ctx) this.ctx.suspend();
  }

  resumeAll() {
    if (!this.ctx) return;
    // Reprise immédiate, dans le geste utilisateur (politique autoplay des navigateurs).
    if (this.ctx.resume) this.ctx.resume().catch(() => {});
    this.playSound('lift', 0);
  }

  playSound(type: string, scale = 1) {
    scale = MyMath.clamp(scale, 0, 1);
    if (!canPlaySoundSelector() || simSpeed < 0.95) return;
    if (!this.ctx) return;
    // Sécurité : si le contexte s'est suspendu (onglet inactif…), on le relance.
    if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume().catch(() => {});

    if (type === 'burstSmall') {
      const now = Date.now();
      if (now - this._lastSmallBurstTime < 20) return;
      this._lastSmallBurstTime = now;
    }

    const source = this.sources[type];
    if (!source) return;

    if (this.mode === 'synth') {
      this.synth(type, scale, source);
      return;
    }

    // ---- Lecture d'échantillon (mode 'samples') ----
    if (!source.buffers || !source.buffers.length) return;
    const initialVolume = source.volume;
    const initialPlaybackRate = MyMath.random(source.playbackRateMin, source.playbackRateMax);
    const scaledVolume = initialVolume * scale;
    const scaledPlaybackRate = initialPlaybackRate * (2 - scale);

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = scaledVolume;
    const buffer = MyMath.randomChoice(source.buffers) as AudioBuffer;
    const bufferSource = this.ctx.createBufferSource();
    bufferSource.playbackRate.value = scaledPlaybackRate;
    bufferSource.buffer = buffer;
    bufferSource.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    bufferSource.start(0);
  }

  // ======================================================================= //
  //  Synthèse Web Audio (aucun fichier externe requis)
  // ======================================================================= //

  /** Salve de bruit filtré avec enveloppe, éventuellement décalée dans le temps. */
  private envNoise(
    filterType: BiquadFilterType,
    freq: number,
    q: number,
    vol: number,
    attack: number,
    decay: number,
    sweepTo?: number,
    delay = 0,
  ) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (sweepTo != null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + attack + decay);
    }
    filter.Q.value = q;
    const gain = ctx.createGain();
    const v = Math.max(0.0002, vol);
    gain.gain.setValueAtTime(0.0002, t0);
    gain.gain.exponentialRampToValueAtTime(v, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0002, t0 + attack + decay);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start(t0);
    src.stop(t0 + attack + decay + 0.05);
  }

  /** « Boum » basse fréquence (corps de l'explosion). */
  private thump(freqStart: number, freqEnd: number, vol: number, decay: number) {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + decay);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0002, vol), t0);
    gain.gain.exponentialRampToValueAtTime(0.0002, t0 + decay);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }

  /** Série de petits « clics » aigus étalés dans le temps (crépitement). */
  private crackle(vol: number, ticks: number, dur: number) {
    for (let i = 0; i < ticks; i++) {
      const delay = Math.random() * dur;
      const f = 3000 + Math.random() * 4000;
      this.envNoise('highpass', f, 0.6, vol * (0.4 + Math.random() * 0.6), 0.001, 0.02 + Math.random() * 0.05, undefined, delay);
    }
  }

  private synth(type: string, scale: number, source: any) {
    const vol = source.volume * scale;
    if (vol <= 0.0005) return; // ex. « lift @0 » de réchauffe : rien à jouer
    const rnd = 0.9 + Math.random() * 0.2; // léger désaccord ±10 %

    switch (type) {
      case 'lift':
        // whoosh montant, discret (départ de fusée)
        this.envNoise('bandpass', 400 * rnd, 1.1, vol * 0.1, 0.04, 0.3, 1300 * rnd);
        break;
      case 'burst':
        // corps grave + souffle large ; plus l'obus est gros/proche (scale ↑),
        // plus c'est grave et long.
        this.thump(110 * rnd, 42, vol * 0.55, 0.3);
        this.envNoise('lowpass', (450 + (1 - scale) * 1400) * rnd, 0.7, vol * 0.5, 0.004, 0.3 + scale * 0.3);
        this.envNoise('highpass', 1800, 0.5, vol * 0.14, 0.003, 0.16);
        break;
      case 'burstSmall':
        this.thump(160 * rnd, 70, vol * 0.25, 0.12);
        this.envNoise('lowpass', (1300 + (1 - scale) * 1400) * rnd, 0.7, vol * 0.7, 0.003, 0.15);
        break;
      case 'crackle':
        this.crackle(vol, 14, 0.6);
        break;
      case 'crackleSmall':
        this.crackle(vol, 8, 0.45);
        break;
    }
  }
}

// =========================================================================== //
//  Moteur public
// =========================================================================== //

const DEFAULT_CONFIG: FireworksConfig = {
  quality: IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL,
  shell: 'Random',
  size: IS_DESKTOP ? 3 : 2,
  autoLaunch: true,
  finale: false,
  skyLighting: SKY_LIGHT_NORMAL,
  longExposure: false,
  trails: true,
  imprints: false,
  scaleFactor: getDefaultScaleFactor(),
  soundEnabled: false,
};

/** Inject once — engine creates DOM outside shadow roots. */
function ensureFireworkGlobalStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('k3-firework-styles')) return;
  const style = document.createElement('style');
  style.id = 'k3-firework-styles';
  style.textContent = `
.firework-root{position:fixed;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none}
.firework-canvas-container{position:absolute;inset:0;width:100%;height:100%;background:#000;pointer-events:none}
.firework-canvas-container--transparent{background:transparent!important}
.firework-canvas{position:absolute;top:0;left:0;mix-blend-mode:lighten;transform:translateZ(0);pointer-events:none}
`;
  document.head.appendChild(style);
}

export class FireworksEngine {
  readonly config: FireworksConfig;
  private root: HTMLElement;
  private container: HTMLElement;
  private trailsCanvas: HTMLCanvasElement;
  private mainCanvas: HTMLCanvasElement;
  private rafId = 0;
  private lastTime = 0;
  private resizeHandler: () => void;
  private _destroyed = false;

  constructor(options: FireworksOptions = {}) {
    const {
      container = document.body,
      zIndex = -1,
      autoStart = true,
      highDPI = true,
      transparentBackground = false,
      soundMode,
      soundBaseUrl = 'assets/audio/firework/',
      soundSources,
      ...configOverrides
    } = options;

    // Fournir des URLs personnalisées implique le mode 'samples' ; sinon 'synth'.
    const effectiveSoundMode: SoundMode = soundMode || (soundSources ? 'samples' : 'synth');

    // Config = défauts + overrides.
    this.config = { ...DEFAULT_CONFIG, ...configOverrides };

    Stage.disableHighDPI = !highDPI;

    ensureFireworkGlobalStyles();

    // DOM : conteneur racine (fixed, derrière le contenu, sans capture pointeur).
    this.root = document.createElement('div');
    this.root.className = 'firework-root';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.style.zIndex = String(zIndex);
    this.root.style.pointerEvents = 'none';

    this.container = document.createElement('div');
    this.container.className = 'firework-canvas-container';
    if (transparentBackground) {
      this.container.classList.add('firework-canvas-container--transparent');
      this.container.style.backgroundColor = 'transparent';
    }

    this.trailsCanvas = document.createElement('canvas');
    this.trailsCanvas.className = 'firework-canvas firework-canvas--trails';
    this.mainCanvas = document.createElement('canvas');
    this.mainCanvas.className = 'firework-canvas firework-canvas--main';

    this.container.appendChild(this.trailsCanvas);
    this.container.appendChild(this.mainCanvas);
    this.root.appendChild(this.container);
    container.appendChild(this.root);

    // Installation des références du module (instance active).
    CONFIG = this.config;
    trailsStage = new Stage(this.trailsCanvas);
    mainStage = new Stage(this.mainCanvas);
    stages = [trailsStage, mainStage];
    canvasContainer = this.container;
    transparentBg = transparentBackground;
    SND = new SoundManager(soundBaseUrl, effectiveSoundMode, soundSources);
    destroyed = false;
    soundEnabled = this.config.soundEnabled;
    simSpeed = 1;
    isFirstSeq = true;

    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);

    this.handleResize();
    configDidUpdate();

    if (this.config.soundEnabled) this.enableSound();

    if (autoStart) this.start();
  }

  // ---- Boucle ------------------------------------------------------------ //

  private frame = (now: number) => {
    if (this._destroyed) return;
    let frameTime = now - this.lastTime;
    this.lastTime = now;
    if (frameTime > 68) frameTime = 68; // éviter les sauts après un onglet inactif
    const lag = frameTime / (1000 / 60);
    update(frameTime, lag);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const containerW = Math.min(w, MAX_WIDTH);
    const containerH = w <= 420 ? h : Math.min(h, MAX_HEIGHT);
    this.root.style.width = containerW + 'px';
    this.root.style.height = containerH + 'px';
    stages.forEach((stage) => stage.resize(containerW, containerH));
    const scaleFactor = scaleFactorSelector();
    stageW = containerW / scaleFactor;
    stageH = containerH / scaleFactor;
  }

  // ---- Contrôle de lecture ---------------------------------------------- //

  /** Démarre / reprend l'animation. */
  start() {
    if (this._destroyed) return;
    paused = false;
    if (!this.rafId) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    }
    if (canPlaySoundSelector()) SND.resumeAll();
  }

  /** Alias de start(). */
  resume() {
    this.start();
  }

  /** Met en pause (l'animation et les séquences se figent). */
  pause() {
    paused = true;
    SND.pauseAll();
  }

  togglePause() {
    if (paused) this.start();
    else this.pause();
  }

  get paused() {
    return paused;
  }

  // ---- Configuration ----------------------------------------------------- //

  /** Met à jour une partie de la config à chaud. */
  setConfig(patch: Partial<FireworksConfig>) {
    Object.assign(this.config, patch);
    CONFIG = this.config;
    if (patch.soundEnabled != null) {
      if (patch.soundEnabled) this.enableSound();
      else this.disableSound();
    }
    configDidUpdate();
    if (patch.scaleFactor != null) this.handleResize();
  }

  getConfig(): FireworksConfig {
    return { ...this.config };
  }

  /** Facteur de vitesse de simulation, 0 (figé) → 1 (normal). */
  setSimSpeed(v: number) {
    simSpeed = MyMath.clamp(v, 0, 1);
    speedBarOpacity = 1;
  }

  // ---- Son --------------------------------------------------------------- //

  /** Active le son. À appeler depuis un geste utilisateur (clic/tap). */
  enableSound() {
    soundEnabled = true;
    this.config.soundEnabled = true;
    // La création de l'AudioContext peut échouer de façon synchrone dans de
    // rares cas ; on protège l'appelant (souvent un gestionnaire de clic).
    try {
      SND.preload().catch(() => {});
      if (isRunning()) SND.resumeAll();
    } catch {
      /* audio indisponible — l'animation continue sans le son. */
    }
  }

  disableSound() {
    soundEnabled = false;
    this.config.soundEnabled = false;
    SND.pauseAll();
  }

  toggleSound() {
    if (soundEnabled) this.disableSound();
    else this.enableSound();
  }

  get soundEnabled() {
    return soundEnabled;
  }

  // ---- Tirs manuels ------------------------------------------------------ //

  /**
   * Lance un unique obus.
   * @param opts.shell type de tir (défaut : config.shell)
   * @param opts.size  taille (défaut : aléatoire autour de config.size)
   * @param opts.x     position horizontale 0→1 (défaut : aléatoire)
   * @param opts.y     hauteur d'explosion 0→1 (défaut : aléatoire)
   */
  launch(opts: { shell?: ShellTypeName; size?: number; x?: number; y?: number } = {}) {
    if (this._destroyed) return;
    this.start();
    const info = getRandomShellSize();
    const sizeVal = opts.size != null ? opts.size : info.size;
    const factory = shellTypes[opts.shell || CONFIG.shell];
    const shell = new Shell(factory(sizeVal));
    shell.launch(opts.x != null ? opts.x : getRandomShellPositionH(), opts.y != null ? opts.y : getRandomShellPositionV());
  }

  /** Lance N obus simultanément, étalés sur la largeur. */
  launchBurst(count: number, opts: { shell?: ShellTypeName; size?: number } = {}) {
    if (this._destroyed) return;
    this.start();
    launchBurst(count, opts);
  }

  // ---- Séquences personnalisées ----------------------------------------- //

  /**
   * Joue une séquence personnalisée. Ex :
   *   fw.playSequence([{count:2},{count:3},{count:2},{finale:true}]);
   * Chaque salve attend automatiquement que la précédente éclose (délai
   * ajustable via `delay`). Cadencé sur l'horloge de simulation : respecte
   * la pause. Interrompt toute séquence en cours.
   */
  playSequence(salvos: SequenceSalvo[], options: SequenceOptions = {}) {
    if (this._destroyed) return;
    this.start();
    seqSteps = compileSequence(salvos);
    seqIndex = 0;
    seqTimer = 0; // démarre à la frame suivante
    seqLoop = !!options.loop;
    seqOnEnd = options.onEnd || null;
  }

  /** Arrête la séquence personnalisée en cours (les tirs déjà en l'air continuent). */
  stopSequence() {
    seqSteps = null;
    seqOnEnd = null;
  }

  /** Vide l'affichage canvas (mode fond transparent). */
  clearIdleDisplay(): void {
    resetTransparentIdleCanvases(true);
  }

  /** true si une séquence personnalisée est en cours. */
  get isPlayingSequence() {
    return seqSteps != null;
  }

  /** Nombre de particules actuellement à l'écran (étoiles + étincelles + flashs). */
  get activeParticleCount(): number {
    return getActiveParticleCount();
  }

  /**
   * true tant qu'« il se passe quelque chose » : des feux sont visibles, une
   * séquence tourne, ou le tir automatique est actif. Sert aux intégrations qui
   * veulent réagir au début/à la fin d'un tir (ex. bascule de thème).
   */
  get isActive(): boolean {
    return this.activeParticleCount > 0 || seqSteps != null || CONFIG.autoLaunch;
  }

  /** true si le ciel est vide et rien n'est programmé. */
  get isIdle(): boolean {
    return !this.isActive;
  }

  // ---- Cycle de vie ------------------------------------------------------ //

  /** Détruit le composant : arrête tout et retire le DOM. */
  destroy() {
    this._destroyed = true;
    destroyed = true;
    paused = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    window.removeEventListener('resize', this.resizeHandler);
    SND.pauseAll();
    seqSteps = null;
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}

export default FireworksEngine;
export { FireworksEngine as Fireworks };
