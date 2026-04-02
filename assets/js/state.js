pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const PDFJS_ASSET_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

function getPdfDocumentTask(source) {
  return pdfjsLib.getDocument({
    ...source,
    cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
    useWorkerFetch: true
  });
}

/* ── State ── */
let pdf = null;
const BASE_PAGE_WIDTH = 760;
let maxW = BASE_PAGE_WIDTH;
let gap = 16;
let scrolling = false;
let scrollSpeed = 0.4;
let scrollRAF = null;
let lastScrollTs = 0;
let scrollCarry = 0;
const AUTO_SCROLL_BASE_PX_PER_SECOND = 96;
const AUTO_SCROLL_UI_TO_EFFECTIVE_MULTIPLIER = 0.5;
let currentMode = 'day';
let rendering = false;
let focusDepth = 220;
let currentPage = 0;
let readingMode = 'pdf';
let flowDocCache = null;
let textDoc = null;
const FLOW_PARSE_FEATURE_FLAGS = {
  columnAwareLineOrdering: true,
  showRemovedArtifactsInDebug: false
};
let emailThreadModel = null;
let emailThreadOrder = 'newest-first';
let chunkCenterY = 0;
let flowChunkIndex = 0;
let flowPointerIndex = 0;
const PROFILE_STORAGE_KEY = 'lumen.profiles.v1';
const SETTINGS_STORAGE_KEY = 'lumen.settings.v1';
const SESSION_SUPPORT_STORAGE_KEY = 'lumen.session-support.v1';
const STATS_STORAGE_KEY = 'lumen.stats.v1';
const DOC_PROGRESS_STORAGE_KEY = 'lumen.doc-progress.v1';
const DOC_STATE_STORAGE_KEY = 'lumen.doc-state.v1';
const PORTABLE_SCHEMA_NAME = 'lumen-portable-state';
const PORTABLE_SCHEMA_VERSION = 1;
const PORTABLE_KDF_ITERATIONS = 250000;
const DOC_STATE_DB_NAME = 'lumen-documents';
const DOC_STATE_STORE = 'documents';
const DOC_STATE_LEGACY_ACTIVE_RECORD_ID = 'active';
const DOC_STATE_RECENT_MAX = 5;
const DOC_STATE_MIGRATION_FLAG = 'legacyImportedV1';
const DOC_SORT_KEY = 'lumen.recent-doc-sort.v1';
const DEFAULT_PROFILE_ID = 'default';
const DEFAULT_SETTINGS = {
  mode: 'day',
  zoom: 100,
  brightness: 100,
  contrast: 100,
  gap: 16,
  typographyOverlay: false,
  readingMode: 'pdf',
  font: 'native',
  textSize: 100,
  lineHeight: 1.5,
  letterSpacing: 0,
  wordSpacing: 0,
  ruler: false,
  paragraphShading: false,
  focusMode: false,
  focusVignette: 72,
  focusDepth: 220,
  tint: 0,
  progressBar: true,
  autoScrollSpeed: 0.8,
  flowSentencePauseBoost: false,
  chunkMode: false,
  chunkHeight: 2,
  flowAutoSplit: false,
  flowSplitLines: 2,
  emailThreadOrder: 'newest-first'
};
const BUILTIN_PROFILES = [
  {
    id: DEFAULT_PROFILE_ID,
    name: 'Default',
    description: 'Balanced defaults for everyday reading.',
    settings: DEFAULT_SETTINGS
  },
  {
    id: 'gentle-focus',
    name: 'Gentle Focus',
    description: 'Light guidance with softer tones and calm pacing.',
    settings: { mode: 'sepia', zoom: 105, width: 760, brightness: 96, contrast: 98, gap: 20, font: 'lora', textSize: 105, lineHeight: 1.7, letterSpacing: 0.25, wordSpacing: 1, ruler: false, paragraphShading: false, focusMode: true, focusVignette: 58, focusDepth: 210, tint: 14, progressBar: true, autoScrollSpeed: 0.7, chunkMode: false, chunkHeight: 2 }
  },
  {
    id: 'dyslexia-spacing-first',
    name: 'Dyslexia: spacing-first',
    description: 'Prioritizes spacing clarity while keeping other aids subtle.',
    settings: { mode: 'day', zoom: 108, width: 800, brightness: 100, contrast: 102, gap: 22, font: 'atkinson', textSize: 112, lineHeight: 1.82, letterSpacing: 0.6, wordSpacing: 2, ruler: false, paragraphShading: false, focusMode: false, focusVignette: 62, focusDepth: 220, tint: 6, progressBar: true, autoScrollSpeed: 1.3, chunkMode: false, chunkHeight: 2 }
  },
  {
    id: 'dyslexia-minimal-visual-aid',
    name: 'Dyslexia: minimal visual aid',
    description: 'Readable font and rhythm with minimal overlays or distractions.',
    settings: { mode: 'day', zoom: 106, width: 790, brightness: 100, contrast: 101, gap: 20, font: 'opendyslexic', textSize: 108, lineHeight: 1.74, letterSpacing: 0.45, wordSpacing: 1.4, ruler: false, paragraphShading: false, focusMode: false, focusVignette: 64, focusDepth: 220, tint: 4, progressBar: true, autoScrollSpeed: 1.1, chunkMode: false, chunkHeight: 2 }
  },
  {
    id: 'adhd-attention-anchoring',
    name: 'ADHD: attention anchoring',
    description: 'Uses gentle anchors (ruler and focus) without stacking extremes.',
    settings: { mode: 'sepia', zoom: 108, width: 710, brightness: 96, contrast: 101, gap: 24, font: 'verdana', textSize: 108, lineHeight: 1.7, letterSpacing: 0.2, wordSpacing: 1.2, ruler: true, paragraphShading: false, focusMode: true, focusVignette: 66, focusDepth: 195, tint: 12, progressBar: true, autoScrollSpeed: 2, chunkMode: true, chunkHeight: 2 }
  },
  {
    id: 'autism-low-sensory-load',
    name: 'Autism: low sensory load',
    description: 'Minimizes sensory intensity with reduced contrast and steady spacing.',
    settings: { mode: 'sepia', zoom: 104, width: 760, brightness: 95, contrast: 96, gap: 20, font: 'lora', textSize: 104, lineHeight: 1.7, letterSpacing: 0.15, wordSpacing: 0.8, ruler: false, paragraphShading: false, focusMode: false, focusVignette: 70, focusDepth: 235, tint: 10, progressBar: true, autoScrollSpeed: 0.9, chunkMode: false, chunkHeight: 2 }
  },
  {
    id: 'high-contrast-calm',
    name: 'High Contrast Calm',
    description: 'High legibility while avoiding aggressive motion cues.',
    settings: { mode: 'dark', zoom: 120, width: 780, brightness: 90, contrast: 130, gap: 20, font: 'verdana', textSize: 112, lineHeight: 1.8, letterSpacing: 0.5, wordSpacing: 1.5, ruler: false, paragraphShading: false, focusMode: true, focusVignette: 70, focusDepth: 250, tint: 12, progressBar: true, autoScrollSpeed: 1.8, chunkMode: false, chunkHeight: 2 }
  }
];
const BUILTIN_PROFILE_MAP = new Map(BUILTIN_PROFILES.map(p => [p.id, p]));
let customProfiles = {};
let lastUsedProfileId = DEFAULT_PROFILE_ID;
let profileCompareState = null;
let compareView = 'current';
let sessionSupportState = {
  durationMin: 0,
  sessionEndTs: 0,
  plannedDurationMin: 0,
  insightsCollapsed: true,
  lowInterruption: false,
  fullscreenDuringSession: false,
  chunkMemory: {
    current: null,
    previous: null
  }
};
let sessionTick = null;
let activeSessionRecord = null;
let sessionManagedFullscreen = false;
let statsState = {
  enabled: true,
  sessions: []
};
let currentDocMeta = null;
let pendingResumeState = null;
let recentDocEntries = [];
let recentDocSortMode = 'last-opened';
let persistSettingsTimer = null;
let flowHoldState = {
  active: false,
  pointerId: null,
  holdStartedTs: 0,
  holdRaf: null
};
const FLOW_HOLD_TIMER_THRESHOLD_MS = 1000;
const FLOW_HUD_THRESHOLD_MS = 2000;
const FLOW_BASE_WPM = 180;
const FLOW_SPEED_READ_MAX_WPM = 900;
const FLOW_SPEED_READ_FALLBACK_WPM = Math.max(40, Math.round(Math.abs(DEFAULT_SETTINGS.autoScrollSpeed) * FLOW_BASE_WPM));
const FLOW_GESTURE_STATES = Object.freeze({
  IDLE: 'idle',
  PRESSING: 'pressing',
  TIMER_VISIBLE: 'timer_visible',
  SPEED_READ_ACTIVE: 'speed_read_active',
  PAUSED_ON_RELEASE: 'paused_on_release'
});
const FLOW_GESTURE_TIMER_VISIBLE_MS = 1000;
const FLOW_GESTURE_ACTIVATE_MS = 2000;
const FLOW_SPEED_READ_INTERVAL_DEBOUNCE_MS = 120;
const FLOW_SPEED_READ_INITIAL_WORD_PAUSE_MS = 500;
let flowGestureState = FLOW_GESTURE_STATES.IDLE;
let flowGesturePressStartTs = 0;
let flowGestureActivePointerId = null;
let flowGestureTimerUiRAF = null;
let flowGestureTimerTimeoutId = null;
let flowGestureActivateTimeoutId = null;
let flowGestureStartContextLabel = '';
let flowSpeedReadWordNodes = [];
let flowSpeedReadTokens = [];
let flowSpeedReadWordIndex = 0;
let flowSpeedReadRAF = null;
let flowSpeedReadActiveWord = null;
let flowSpeedReadIntervalUpdateTimer = null;
let flowSpeedReadPlaybackWpm = FLOW_SPEED_READ_FALLBACK_WPM;
let flowSpeedReadIntervalMs = 60000 / FLOW_SPEED_READ_FALLBACK_WPM;
let flowSpeedReadNextWordAt = 0;
let flowHoveredWordNode = null;
let flowDefinitionDelayTimer = null;
let flowDefinitionLookupController = null;
const flowDefinitionCache = new Map();
const flowGestureEventListeners = new Map();
const FLOW_SENTENCE_END_PUNCTUATION = /[.!?…]["'"')\]]*$/;
const FLOW_SENTENCE_PAUSE_MULTIPLIER = 1.22;

const reader = document.getElementById('reader');
const rInner = document.getElementById('rInner');
const flowLayer = document.getElementById('flowLayer');
const flowHoldTimer = document.getElementById('flowHoldTimer');
const flowSpeedHud = document.getElementById('flowSpeedHud');
const flowHudWpm = document.getElementById('flowHudWpm');
const flowHudState = document.getElementById('flowHudState');
const flowHudProgress = document.getElementById('flowHudProgress');
const flowGestureTimer = document.getElementById('flowGestureTimer');
const flowGestureTimerLabel = document.getElementById('flowGestureTimerLabel');
const flowGestureTimerValue = document.getElementById('flowGestureTimerValue');
const flowSpeedBackdrop = document.getElementById('flowSpeedBackdrop');
const flowWordRenderer = document.getElementById('flowWordRenderer');
const flowWordRendererToken = document.getElementById('flowWordRendererToken');
const flowDefinitionPopout = document.getElementById('flowDefinitionPopout');
const flowDefinitionTerm = document.getElementById('flowDefinitionTerm');
const flowDefinitionText = document.getElementById('flowDefinitionText');
const flowGestureAnnouncer = document.getElementById('flowGestureAnnouncer');
const sidebarPanel = document.getElementById('sidebarPanel');
const scrollWpmInput = document.getElementById('scrollWpmIn');
const MOBILE_BREAKPOINT = 900;
let sidebarOpen = true;
let mobileViewport = false;
const prefersReducedMotionQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null;
const supportsFinePointer = typeof window.matchMedia === 'function'
  ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
  : true;
