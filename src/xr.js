/**
 * ============================================================================
 * xr.js — Gestión de Sesión WebXR
 * ============================================================================
 *
 * Este módulo gestiona todo el ciclo de vida de la sesión WebXR usando
 * directamente la WebXR Device API. NO utiliza wrappers ni librerías
 * intermediarias.
 *
 * Responsabilidades:
 * - Detectar soporte de WebXR en el navegador
 * - Solicitar sesión immersive-ar (passthrough)
 * - Gestionar el espacio de referencia (referenceSpace)
 * - Procesar frames XR y actualizar poses
 * - Gestionar controladores y su tracking
 * - Emitir eventos de ciclo de vida (sessionstart, sessionend, etc.)
 * ============================================================================
 */

import {
  XR_SESSION_MODE,
  XR_REFERENCE_SPACE,
  XR_OPTIONAL_FEATURES
} from './config.js';

/**
 * Estados posibles de la sesión XR
 */
export const XRState = {
  NOT_SUPPORTED: 'not_supported',  // WebXR no disponible
  AR_NOT_SUPPORTED: 'ar_not_supported', // immersive-ar no soportado
  IDLE: 'idle',                    // Listo para iniciar
  STARTING: 'starting',            // Solicitando sesión
  RUNNING: 'running',              // Sesión activa
  ENDING: 'ending',                // Cerrando sesión
  ERROR: 'error'                   // Error en la sesión
};

/**
 * Clase XRSessionManager — Gestor de Sesión WebXR
 *
 * Encapsula toda la lógica de la WebXR Device API.
 * Proporciona una interfaz limpia para iniciar/detener la sesión
 * y acceder a los datos del frame actual.
 */
export class XRSessionManager {
  /**
   * @param {THREE.WebGLRenderer} renderer — Renderer de Three.js
   * @param {Function} onFrame — Callback llamado cada frame XR
   * @param {Function} onStateChange — Callback llamado al cambiar de estado
   */
  constructor(renderer, onFrame, onStateChange) {
    this.renderer = renderer;
    this.onFrame = onFrame;
    this.onStateChange = onStateChange;

    // Estado actual
    this.state = XRState.IDLE;

    // Objetos WebXR
    this.session = null;
    this.referenceSpace = null;
    this.baseLayer = null;

    // Frame binding
    this._onXRFrame = this._onXRFrame.bind(this);

    // Controladores
    this.controllers = [];
    this.controllerGrips = [];

    // Pose actual del headset
    this.viewerPose = null;
  }

  /**
   * Verifica si el navegador soporta WebXR.
   * @returns {boolean} true si navigator.xr está disponible
   */
  static isWebXRSupported() {
    return !!(navigator.xr);
  }

  /**
   * Verifica si el modo immersive-ar es soportado.
   * @returns {Promise<boolean>}
   */
  async isARSupported() {
    if (!XRSessionManager.isWebXRSupported()) {
      return false;
    }
    try {
      return await navigator.xr.isSessionSupported(XR_SESSION_MODE);
    } catch {
      return false;
    }
  }

  /**
   * Cambia el estado interno y notifica al callback.
   * @param {string} newState — Nuevo estado de XRState
   * @param {Object} data — Datos adicionales del estado
   */
  _setState(newState, data = {}) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(newState, data);
    }
  }

  /**
   * Inicia la sesión WebXR immersive-ar.
   *
   * Flujo:
   * 1. Verificar que WebXR esté disponible
   * 2. Verificar que immersive-ar sea soportado
   * 3. Solicitar la sesión con requestSession()
   * 4. Configurar el espacio de referencia
   * 5. Configurar el render layer
   * 6. Iniciar el render loop
   */
  async startSession() {
    // ── 1. Verificar soporte de WebXR ──
    if (!XRSessionManager.isWebXRSupported()) {
      this._setState(XRState.NOT_SUPPORTED, {
        message: 'WebXR no está disponible en este navegador.',
        detail: 'Para utilizar Quest Widgets, abre esta aplicación en Meta Quest Browser.'
      });
      return false;
    }

    // ── 2. Verificar soporte de immersive-ar ──
    const arSupported = await this.isARSupported();
    if (!arSupported) {
      this._setState(XRState.AR_NOT_SUPPORTED, {
        message: 'Mixed Reality (passthrough) no es compatible con este navegador.',
        detail: 'Asegúrate de usar Meta Quest 3 con Meta Quest Browser y la última actualización de sistema.',
        note: 'La función de passthrough mediante immersive-ar requiere soporte nativo del navegador. Esta capacidad solo está disponible a través de WebXR en Meta Quest Browser; aplicaciones nativas usan Meta XR SDK.'
      });
      return false;
    }

    this._setState(XRState.STARTING);

    try {
      // ── 3. Solicitar sesión XR ──
      this.session = await navigator.xr.requestSession(XR_SESSION_MODE, {
        requiredFeatures: [],
        optionalFeatures: XR_OPTIONAL_FEATURES
      });

      // ── 4. Configurar espacio de referencia ──
      this.referenceSpace = await this.session.requestReferenceSpace(XR_REFERENCE_SPACE);

      // ── 5. Configurar render layer ──
      const gl = this.renderer.getContext();
      this.baseLayer = new XRWebGLLayer(this.session, gl);
      this.session.updateRenderState({
        baseLayer: this.baseLayer,
        depthNear: 0.1,
        depthFar: 100
      });

      // ── 6. Iniciar render loop ──
      this.session.requestAnimationFrame(this._onXRFrame);

      this._setState(XRState.RUNNING);
      return true;

    } catch (error) {
      this._setState(XRState.ERROR, {
        message: 'Error al iniciar la sesión XR',
        detail: error.message
      });
      return false;
    }
  }

  /**
   * Callback ejecutado en cada frame de la sesión XR.
   *
   * Procesa:
   * - Obtener el frame XR
   * - Obtener la pose del viewer (headset)
   * - Obtener poses de controladores
   * - Llamar al callback onFrame con los datos procesados
   * - Solicitar el siguiente frame
   *
   * @param {DOMHighResTimeStamp} time — Tiempo del frame
   * @param {XRFrame} frame — Frame XR
   */
  _onXRFrame(time, frame) {
    if (!this.session || this.state !== XRState.RUNNING) {
      return;
    }

    // Solicitar siguiente frame inmediatamente
    this.session.requestAnimationFrame(this._onXRFrame);

    // Obtener la pose del viewer (headset) en el espacio de referencia
    this.viewerPose = frame.getViewerPose(this.referenceSpace);

    if (this.viewerPose) {
      // Procesar cada vista (ojo izquierdo y derecho)
      const views = [];
      for (const view of this.viewerPose.views) {
        const viewport = this.baseLayer.getViewport(view);
        views.push({
          view,
          viewport
        });
      }

      // Llamar al callback de frame con los datos
      if (this.onFrame) {
        this.onFrame({
          time,
          frame,
          pose: this.viewerPose,
          views,
          referenceSpace: this.referenceSpace
        });
      }
    }
  }

  /**
   * Finaliza la sesión XR activa.
   * Limpia todos los recursos asociados.
   */
  async endSession() {
    if (!this.session) {
      return;
    }

    this._setState(XRState.ENDING);

    try {
      await this.session.end();
    } catch (error) {
      console.warn('Error al finalizar sesión XR:', error);
    }

    this.session = null;
    this.referenceSpace = null;
    this.baseLayer = null;
    this.viewerPose = null;

    this._setState(XRState.IDLE);
  }

  /**
   * Obtiene la posición y orientación actual del headset.
   * @returns {XRPose|null} Pose del viewer o null
   */
  getViewerPose() {
    return this.viewerPose;
  }

  /**
   * Obtiene la sesión XR actual.
   * @returns {XRSession|null}
   */
  getSession() {
    return this.session;
  }

  /**
   * Obtiene el espacio de referencia.
   * @returns {XRReferenceSpace|null}
   */
  getReferenceSpace() {
    return this.referenceSpace;
  }

  /**
   * Verifica si hay una sesión activa.
   * @returns {boolean}
   */
  isRunning() {
    return this.state === XRState.RUNNING && this.session !== null;
  }

  /**
   * Libera todos los recursos del gestor XR.
   */
  dispose() {
    if (this.session) {
      this.endSession();
    }
    this.session = null;
    this.referenceSpace = null;
    this.baseLayer = null;
    this.viewerPose = null;
  }
}
