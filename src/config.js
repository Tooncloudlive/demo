/**
 * ============================================================================
 * config.js — Configuración Global de Quest Widgets
 * ============================================================================
 *
 * Este archivo centraliza todas las constantes configurables del sistema.
 * Modificar los valores aquí afecta a toda la aplicación.
 *
 * Responsabilidades:
 * - Formato de hora (12h / 24h)
 * - Dimensiones y posición del panel flotante
 * - Colores del tema glassmorphism
 * - Parámetros de animación
 * - Opciones de renderizado
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO DE RELOJ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formato de visualización de la hora.
 * Valores válidos: '24h' | '12h'
 * - '24h' → muestra 22:47
 * - '12h' → muestra 10:47 PM
 */
export const TIME_FORMAT = '24h';

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSIONES DEL PANEL (en metros del mundo virtual)
// ─────────────────────────────────────────────────────────────────────────────

/** Ancho del panel flotante en metros */
export const PANEL_WIDTH = 0.40;

/** Alto del panel flotante en metros */
export const PANEL_HEIGHT = 0.25;

/** Profundidad/extrusión del panel en metros (efecto 3D sutil) */
export const PANEL_DEPTH = 0.012;

/** Radio de redondeo de las esquinas (pixels equivalentes) */
export const PANEL_CORNER_RADIUS = 28;

/** Padding interno del panel en metros */
export const PANEL_PADDING = 0.032;

/** Distancia inicial del panel frente al usuario (metros) */
export const PANEL_DISTANCE = 1.5;

/** Altura del panel respecto al suelo (metros) */
export const PANEL_HEIGHT_FROM_FLOOR = 1.5;

// ─────────────────────────────────────────────────────────────────────────────
// COLORES — Tema Glassmorphism (Apple Vision Pro style)
// ─────────────────────────────────────────────────────────────────────────────

/** Opacidad del fondo del panel (0.0 - 1.0) */
export const GLASS_OPACITY = 0.20;

/** Opacidad del borde del panel */
export const GLASS_BORDER_OPACITY = 0.30;

/** Opacidad del highlight superior (efecto de luz) */
export const GLASS_HIGHLIGHT_OPACITY = 0.45;

/** Color de la sombra del panel */
export const SHADOW_COLOR = 0x000000;

/** Opacidad de la sombra */
export const SHADOW_OPACITY = 0.15;

/** Color del texto principal (hora) */
export const TEXT_PRIMARY_COLOR = '#FFFFFF';

/** Color del texto secundario (fecha) */
export const TEXT_SECONDARY_COLOR = 'rgba(255, 255, 255, 0.70)';

/** Color del texto del botón */
export const BUTTON_TEXT_COLOR = '#FFFFFF';

/** Color de fondo del botón en hover */
export const BUTTON_HOVER_BG = 'rgba(255, 255, 255, 0.12)';

/** Color de fondo del botón en estado normal */
export const BUTTON_NORMAL_BG = 'rgba(255, 255, 255, 0.06)';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOGRAFÍA
// ─────────────────────────────────────────────────────────────────────────────

/** Tamaño de fuente para la hora (en píxeles del canvas) */
export const FONT_SIZE_TIME = 72;

/** Tamaño de fuente para la fecha */
export const FONT_SIZE_DATE = 18;

/** Tamaño de fuente para el botón */
export const FONT_SIZE_BUTTON = 14;

/** Familia tipográfica */
export const FONT_FAMILY = 'system-ui, -apple-system, SF Pro Display, sans-serif';

// ─────────────────────────────────────────────────────────────────────────────
// PARÁMETROS DE ANIMACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** Duración del fade de entrada (milisegundos) */
export const ANIMATION_FADE_IN_DURATION = 800;

/** Duración de la animación de recentrado (milisegundos) */
export const ANIMATION_RECENTER_DURATION = 600;

/** Factor de suavizado para el arrastre (0.0 - 1.0, menor = más suave) */
export const DRAG_LERP_FACTOR = 0.15;

/** Escala al hacer hover sobre el panel */
export const HOVER_SCALE = 1.02;

/** Escala al presionar el panel */
export const PRESS_SCALE = 0.98;

/** Amplitud de la animación de flotación idle (en metros) */
export const IDLE_FLOAT_AMPLITUDE = 0.0005;

/** Velocidad de la animación de flotación idle */
export const IDLE_FLOAT_SPEED = 1.5;

/** Función de easing para recentrado: ease-out-cubic */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE RENDERIZADO
// ─────────────────────────────────────────────────────────────────────────────

/** Color de fondo del renderer (transparente para passthrough) */
export const RENDERER_BACKGROUND = null; // null = transparente

/** Activar antialiasing */
export const RENDERER_ANTIALIAS = true;

/** Pixel ratio del renderer (1.0 para rendimiento en Quest) */
export const RENDERER_PIXEL_RATIO = 1.0;

/** FOV de la cámara en grados */
export const CAMERA_FOV = 75;

/** Posición inicial de la cámara (metros) */
export const CAMERA_POSITION = { x: 0, y: 1.6, z: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE WEBXR
// ─────────────────────────────────────────────────────────────────────────────

/** Modo de sesión XR (immersive-ar para passthrough) */
export const XR_SESSION_MODE = 'immersive-ar';

/** Espacio de referencia requerido */
export const XR_REFERENCE_SPACE = 'local-floor';

/** Características opcionales de la sesión XR */
export const XR_OPTIONAL_FEATURES = ['local-floor', 'hit-test', 'dom-overlay'];

// ─────────────────────────────────────────────────────────────────────────────
// NOMBRES DE MESES Y DÍAS EN ESPAÑOL
// ─────────────────────────────────────────────────────────────────────────────

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DAYS_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];
