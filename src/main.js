/**
 * ============================================================================
 * main.js — Núcleo de la Aplicación Quest Widgets
 * ============================================================================
 *
 * Este es el archivo principal que orquesta toda la aplicación.
 * Integra Three.js, WebXR Device API y los módulos del widget de reloj.
 *
 * Responsabilidades:
 * - Inicializar la escena Three.js (cámara, renderer, luces)
 * - Gestionar el ciclo de vida de la sesión WebXR
 * - Crear y posicionar el panel flotante del reloj
 * - Procesar entrada de controladores (puntero láser, arrastre)
 * - Animar el recentrado del panel
 * - Ejecutar el render loop
 * - Manejar eventos de resize y estados XR
 * ============================================================================
 */

import * as THREE from 'three';
import { XRSessionManager, XRState } from './xr.js';
import { UIPanel } from './ui.js';
import { ClockWidget } from './clock.js';
import {
  PANEL_DISTANCE,
  PANEL_HEIGHT_FROM_FLOOR,
  ANIMATION_RECENTER_DURATION,
  DRAG_LERP_FACTOR,
  IDLE_FLOAT_AMPLITUDE,
  IDLE_FLOAT_SPEED,
  easeOutCubic,
  RENDERER_BACKGROUND,
  RENDERER_ANTIALIAS,
  RENDERER_PIXEL_RATIO,
  CAMERA_FOV,
  CAMERA_POSITION
} from './config.js';

/**
 * Clase QuestWidgetsApp — Aplicación principal
 *
 * Orquesta todos los módulos y gestiona el estado global de la aplicación.
 */
class QuestWidgetsApp {
  constructor() {
    // ── Estado de la aplicación ──
    this.isInitialized = false;
    this.isXRSessionActive = false;

    // ── Objetos Three.js ──
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // ── Módulos ──
    this.xrManager = null;
    this.uiPanel = null;
    this.clockWidget = null;

    // ── Posicionamiento del panel ──
    this.panelTargetPosition = new THREE.Vector3();
    this.panelCurrentPosition = new THREE.Vector3();
    this.originalPanelPosition = new THREE.Vector3();
    this.isDragging = false;
    this.isRecentering = false;
    this.recenterStartTime = 0;
    this.recenterStartPosition = new THREE.Vector3();
    this.hasMovedFromOrigin = false;

    // ── Controladores ──
    this.controller1 = null; // Mano derecha
    this.controller2 = null; // Mano izquierda
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.dragController = null; // Controlador activo durante arrastre

    // ── Render loop ──
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;

    // ── Bindings ──
    this._onWindowResize = this._onWindowResize.bind(this);
    this._onXRFrame = this._onXRFrame.bind(this);
    this._onXRStateChange = this._onXRStateChange.bind(this);
    this._renderLoop = this._renderLoop.bind(this);
  }

  /**
   * Inicializa la aplicación completa.
   * Crea la escena Three.js, el renderer, la cámara y los módulos.
   */
  async init() {
    if (this.isInitialized) return;

    console.log('[QuestWidgets] Inicializando aplicación...');

    // ── 1. Crear escena ──
    this.scene = new THREE.Scene();
    // No añadimos fondo (null = transparente para passthrough)
    this.scene.background = RENDERER_BACKGROUND;

    // ── 2. Crear cámara ──
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(
      CAMERA_POSITION.x,
      CAMERA_POSITION.y,
      CAMERA_POSITION.z
    );

    // ── 3. Crear renderer ──
    this.renderer = new THREE.WebGLRenderer({
      antialias: RENDERER_ANTIALIAS,
      alpha: true // Fondo transparente para passthrough
    });
    this.renderer.setPixelRatio(RENDERER_PIXEL_RATIO);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true; // Habilitar WebXR
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Añadir canvas al DOM
    const container = document.getElementById('app');
    container.appendChild(this.renderer.domElement);

    // ── 4. Luces (mínimas, el panel es emisivo) ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(0, 2, 1);
    this.scene.add(directionalLight);

    // ── 5. Crear panel de UI (glassmorphism) ──
    this.uiPanel = new UIPanel(this.scene);

    // Posicionar panel frente al usuario
    this._calculateDefaultPanelPosition();
    this.panelCurrentPosition.copy(this.originalPanelPosition);
    this.panelTargetPosition.copy(this.originalPanelPosition);
    this.uiPanel.setPosition(this.panelCurrentPosition);

    // Configurar callback de recentrado
    this.uiPanel.onRecenter(() => {
      this.startRecenterAnimation();
    });

    // ── 6. Crear widget de reloj ──
    this.clockWidget = new ClockWidget(this.scene);
    // Adjuntar el reloj al panel para que se mueva junto con él
    this.clockWidget.attachTo(this.uiPanel.group);
    // Posicionar el reloj centrado en el panel
    this.clockWidget.setPosition(0, 0, PANEL_DISTANCE);

    // ── 7. Configurar controladores XR ──
    this._setupControllers();

    // ── 8. Crear gestor XR ──
    this.xrManager = new XRSessionManager(
      this.renderer,
      this._onXRFrame,
      this._onXRStateChange
    );

    // ── 9. Eventos ──
    window.addEventListener('resize', this._onWindowResize);

    this.isInitialized = true;
    console.log('[QuestWidgets] Aplicación inicializada correctamente');

    // ── 10. Verificar WebXR y mostrar estado ──
    this._checkWebXRSupport();
  }

  /**
   * Calcula la posición por defecto del panel (1.5m frente al usuario).
   */
  _calculateDefaultPanelPosition() {
    // Posicionar a 1.5m frente al usuario, a la altura de los ojos
    this.originalPanelPosition.set(
      0,                    // Centro en X
      PANEL_HEIGHT_FROM_FLOOR, // Altura del panel
      -PANEL_DISTANCE       // Negativo Z = frente al usuario
    );
  }

  /**
   * Configura los controladores VR para interacción.
   * Crea los objetos de Three.js para los controladores.
   */
  _setupControllers() {
    // Controlador 1 (mano derecha - típicamente usada para apuntar)
    this.controller1 = this.renderer.xr.getController(0);
    this.controller1.addEventListener('selectstart', (e) => this._onControllerSelectStart(e, 0));
    this.controller1.addEventListener('selectend', (e) => this._onControllerSelectEnd(e, 0));
    this.scene.add(this.controller1);

    // Controlador 2 (mano izquierda)
    this.controller2 = this.renderer.xr.getController(1);
    this.controller2.addEventListener('selectstart', (e) => this._onControllerSelectStart(e, 1));
    this.controller2.addEventListener('selectend', (e) => this._onControllerSelectEnd(e, 1));
    this.scene.add(this.controller2);

    // Visual del rayo láser para cada controlador
    this._createLaserPointer(this.controller1);
    this._createLaserPointer(this.controller2);
  }

  /**
   * Crea un rayo láser visual para un controlador.
   * @param {THREE.Object3D} controller — Objeto del controlador
   */
  _createLaserPointer(controller) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ]);

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      linewidth: 1
    });

    const line = new THREE.Line(geometry, material);
    line.name = 'laser';
    line.scale.z = 2; // Longitud del rayo
    controller.add(line);

    // Punto de intersección (cursor)
    const cursorGeometry = new THREE.SphereGeometry(0.005, 8, 8);
    const cursorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });
    const cursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
    cursor.name = 'cursor';
    cursor.visible = false;
    controller.add(cursor);
  }

  /**
   * Verifica el soporte de WebXR y actualiza la UI.
   */
  async _checkWebXRSupport() {
    const startButton = document.getElementById('start-button');
    const errorScreen = document.getElementById('error-screen');
    const errorTitle = document.getElementById('error-title');
    const errorDetail = document.getElementById('error-detail');
    const errorNote = document.getElementById('error-note');

    if (!XRSessionManager.isWebXRSupported()) {
      // WebXR no está disponible
      startButton.style.display = 'none';
      errorScreen.style.display = 'flex';
      errorTitle.textContent = 'WebXR no disponible';
      errorDetail.textContent = 'WebXR no está disponible en este navegador. Para utilizar Quest Widgets, abre esta aplicación en Meta Quest Browser.';
      errorNote.style.display = 'none';
      return;
    }

    const arSupported = await this.xrManager.isARSupported();
    if (!arSupported) {
      // immersive-ar no soportado
      startButton.style.display = 'none';
      errorScreen.style.display = 'flex';
      errorTitle.textContent = 'Mixed Reality no compatible';
      errorDetail.textContent = 'Mixed Reality (passthrough) no es compatible con este navegador o versión de firmware. Asegúrate de usar Meta Quest 3 con la última actualización de sistema.';
      errorNote.textContent = 'Nota: La función de passthrough mediante immersive-ar requiere soporte nativo del navegador. Esta capacidad solo está disponible a través de WebXR en Meta Quest Browser.';
      return;
    }

    // Todo bien, mostrar botón de inicio
    startButton.style.display = 'block';
    startButton.addEventListener('click', () => this.startXRSession());
  }

  /**
   * Inicia la sesión WebXR immersive-ar.
   */
  async startXRSession() {
    const startButton = document.getElementById('start-button');
    startButton.textContent = 'Iniciando...';
    startButton.disabled = true;

    const success = await this.xrManager.startSession();

    if (success) {
      // Ocultar la pantalla de inicio
      document.getElementById('start-screen').style.display = 'none';
      this.isXRSessionActive = true;

      // El render loop ahora es manejado por WebXR
      this.renderer.setAnimationLoop(null);
    } else {
      startButton.textContent = 'Entrar en Realidad Mixta';
      startButton.disabled = false;
    }
  }

  /**
   * Callback llamado cuando cambia el estado de la sesión XR.
   * @param {string} state — Nuevo estado
   * @param {Object} data — Datos adicionales
   */
  _onXRStateChange(state, data) {
    console.log('[QuestWidgets] Estado XR:', state, data);

    const errorScreen = document.getElementById('error-screen');
    const errorTitle = document.getElementById('error-title');
    const errorDetail = document.getElementById('error-detail');
    const errorNote = document.getElementById('error-note');

    switch (state) {
      case XRState.NOT_SUPPORTED:
      case XRState.AR_NOT_SUPPORTED:
        errorScreen.style.display = 'flex';
        errorTitle.textContent = data.message || 'Error';
        errorDetail.textContent = data.detail || '';
        if (data.note) {
          errorNote.textContent = data.note;
          errorNote.style.display = 'block';
        }
        break;

      case XRState.ERROR:
        errorScreen.style.display = 'flex';
        errorTitle.textContent = data.message || 'Error desconocido';
        errorDetail.textContent = data.detail || '';
        break;

      case XRState.IDLE:
        // Sesión terminada, volver a pantalla de inicio
        this.isXRSessionActive = false;
        document.getElementById('start-screen').style.display = 'flex';
        document.getElementById('start-button').textContent = 'Entrar en Realidad Mixta';
        document.getElementById('start-button').disabled = false;
        break;
    }
  }

  /**
   * Callback llamado en cada frame de la sesión XR.
   * @param {Object} xrData — Datos del frame XR
   */
  _onXRFrame(xrData) {
    const { time, pose, views } = xrData;

    if (!pose) return;

    // Obtener la posición del headset para hacer que el panel mire al usuario
    const headsetPosition = new THREE.Vector3(
      pose.transform.position.x,
      pose.transform.position.y,
      pose.transform.position.z
    );

    // ── Actualizar panel ──
    this._updatePanel(headsetPosition);

    // ── Procesar interacción con controladores ──
    this._processControllerInteraction(headsetPosition);

    // ── Renderizar cada vista (ojo izquierdo y derecho) ──
    this.renderer.autoClear = false;
    this.renderer.clear();

    for (const { view, viewport } of views) {
      const camera = this.camera;

      // Obtener la matriz de vista y proyección del frame XR
      camera.matrix.fromArray(view.transform.matrix);
      camera.matrixWorldNeedsUpdate = true;
      camera.projectionMatrix.fromArray(view.projectionMatrix);

      // Aplicar viewport
      this.renderer.setViewport(
        viewport.x,
        viewport.y,
        viewport.width,
        viewport.height
      );

      // Renderizar la escena
      this.renderer.render(this.scene, camera);
    }
  }

  /**
   * Actualiza la posición y orientación del panel cada frame.
   * Gestiona: arrastre, recentrado, flotación idle, mirar al usuario.
   * @param {THREE.Vector3} headsetPosition — Posición actual del headset
   */
  _updatePanel(headsetPosition) {
    const deltaTime = this.clock.getDelta() * 1000; // ms
    this.elapsedTime += deltaTime;

    // ── Animación de recentrado ──
    if (this.isRecentering) {
      const progress = Math.min(
        (performance.now() - this.recenterStartTime) / ANIMATION_RECENTER_DURATION,
        1.0
      );
      const easedProgress = easeOutCubic(progress);

      this.panelCurrentPosition.lerpVectors(
        this.recenterStartPosition,
        this.originalPanelPosition,
        easedProgress
      );

      if (progress >= 1.0) {
        this.isRecentering = false;
        this.hasMovedFromOrigin = false;
        this.uiPanel.setButtonVisible(false);
      }
    }

    // ── Arrastre con controlador ──
    if (this.isDragging && this.dragController) {
      // Obtener la dirección del controlador
      const controllerPosition = new THREE.Vector3();
      const controllerDirection = new THREE.Vector3();

      this.dragController.getWorldPosition(controllerPosition);
      this.dragController.getWorldDirection(controllerDirection);
      controllerDirection.negate(); // El rayo apunta hacia adelante del controlador

      // Calcular intersección con un plano a la distancia original
      const distance = this.originalPanelPosition.distanceTo(
        new THREE.Vector3(headsetPosition.x, PANEL_HEIGHT_FROM_FLOOR, headsetPosition.z)
      );

      // Proyectar el rayo del controlador a la distancia del panel
      const targetPos = controllerPosition.clone().add(
        controllerDirection.multiplyScalar(distance * 1.5)
      );

      // Suavizar el movimiento con lerp
      this.panelTargetPosition.copy(targetPos);
      this.panelCurrentPosition.lerp(this.panelTargetPosition, DRAG_LERP_FACTOR);
    }

    // ── Flotación idle (sutil oscilación vertical) ──
    const floatOffset = Math.sin(this.elapsedTime * 0.001 * IDLE_FLOAT_SPEED) * IDLE_FLOAT_AMPLITUDE;

    // ── Aplicar posición final ──
    const finalPosition = this.panelCurrentPosition.clone();
    if (!this.isDragging && !this.isRecentering) {
      finalPosition.y += floatOffset;
    }
    this.uiPanel.setPosition(finalPosition);

    // ── Panel siempre mira al usuario ──
    this.uiPanel.lookAt(headsetPosition);

    // ── Actualizar UI ──
    this.uiPanel.update(deltaTime, this.elapsedTime);
  }

  /**
   * Procesa la interacción con los controladores.
   * Detecta hover y clicks en el panel y el botón.
   * @param {THREE.Vector3} headsetPosition — Posición del headset
   */
  _processControllerInteraction(headsetPosition) {
    if (this.isDragging) return; // No procesar hover durante arrastre

    const controllers = [this.controller1, this.controller2];
    let isHoveringPanel = false;
    let isHoveringButton = false;

    for (const controller of controllers) {
      if (!controller) continue;

      // Obtener dirección del rayo del controlador
      this.tempMatrix.identity().extractRotation(controller.matrixWorld);
      const rayOrigin = new THREE.Vector3();
      controller.getWorldPosition(rayOrigin);
      const rayDirection = new THREE.Vector3(0, 0, -1).applyMatrix4(this.tempMatrix);

      this.raycaster.set(rayOrigin, rayDirection);

      // Verificar intersección con el panel
      const panelIntersects = this.raycaster.intersectObject(
        this.uiPanel.panelMesh,
        false
      );

      if (panelIntersects.length > 0) {
        isHoveringPanel = true;

        // Actualizar visual del láser
        const laser = controller.getObjectByName('laser');
        const cursor = controller.getObjectByName('cursor');
        if (laser) laser.scale.z = panelIntersects[0].distance;
        if (cursor) {
          cursor.visible = true;
          cursor.position.set(0, 0, -panelIntersects[0].distance);
        }

        // Verificar intersección con el botón
        if (this.uiPanel.buttonMesh && this.uiPanel.buttonMesh.visible) {
          const buttonIntersects = this.raycaster.intersectObject(
            this.uiPanel.buttonMesh,
            false
          );
          if (buttonIntersects.length > 0) {
            isHoveringButton = true;
          }
        }
      } else {
        // Resetear visual del láser
        const laser = controller.getObjectByName('laser');
        const cursor = controller.getObjectByName('cursor');
        if (laser) laser.scale.z = 2;
        if (cursor) cursor.visible = false;
      }
    }

    // Actualizar estado visual del panel
    this.uiPanel.setHover(isHoveringPanel);
    this.uiPanel.setButtonVisible(this.hasMovedFromOrigin || isHoveringPanel);

    // Actualizar estado del botón
    if (isHoveringButton) {
      this.uiPanel.buttonMesh.material.uniforms.uBgOpacity.value = 0.12;
    } else {
      this.uiPanel.buttonMesh.material.uniforms.uBgOpacity.value = 0.06;
    }
  }

  /**
   * Callback cuando se presiona el trigger de un controlador.
   * @param {Event} event — Evento de Three.js
   * @param {number} controllerIndex — Índice del controlador
   */
  _onControllerSelectStart(event, controllerIndex) {
    const controller = controllerIndex === 0 ? this.controller1 : this.controller2;

    // Verificar si el rayo intersecta con el panel
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    const rayOrigin = new THREE.Vector3();
    controller.getWorldPosition(rayOrigin);
    const rayDirection = new THREE.Vector3(0, 0, -1).applyMatrix4(this.tempMatrix);

    this.raycaster.set(rayOrigin, rayDirection);

    // Verificar intersección con el botón primero
    if (this.uiPanel.buttonMesh && this.uiPanel.buttonMesh.visible) {
      const buttonIntersects = this.raycaster.intersectObject(
        this.uiPanel.buttonMesh,
        false
      );
      if (buttonIntersects.length > 0) {
        // Click en el botón de recentrar
        this.uiPanel.triggerRecenter();
        return;
      }
    }

    // Verificar intersección con el panel
    const panelIntersects = this.raycaster.intersectObject(
      this.uiPanel.panelMesh,
      false
    );

    if (panelIntersects.length > 0) {
      // Iniciar arrastre
      this.isDragging = true;
      this.dragController = controller;
      this.uiPanel.setPressed(true);
    }
  }

  /**
   * Callback cuando se suelta el trigger de un controlador.
   * @param {Event} event — Evento de Three.js
   * @param {number} controllerIndex — Índice del controlador
   */
  _onControllerSelectEnd(event, controllerIndex) {
    if (this.isDragging) {
      this.isDragging = false;
      this.dragController = null;
      this.uiPanel.setPressed(false);

      // Verificar si el panel se movió de su posición original
      const distanceFromOrigin = this.panelCurrentPosition.distanceTo(
        this.originalPanelPosition
      );
      this.hasMovedFromOrigin = distanceFromOrigin > 0.1; // 10cm de tolerancia

      if (this.hasMovedFromOrigin) {
        this.uiPanel.setButtonVisible(true);
      }
    }
  }

  /**
   * Inicia la animación de recentrado del panel.
   * El panel vuelve suavemente a su posición original frente al usuario.
   */
  startRecenterAnimation() {
    if (this.isRecentering) return;

    this.isRecentering = true;
    this.recenterStartTime = performance.now();
    this.recenterStartPosition.copy(this.panelCurrentPosition);

    // Recalcular posición original (por si el usuario se movió)
    this._calculateDefaultPanelPosition();
  }

  /**
   * Render loop para modo no-XR (preview en desktop).
   * Se usa para mostrar el panel en el navegador antes de entrar a XR.
   */
  _renderLoop() {
    if (this.isXRSessionActive) return; // WebXR maneja su propio loop

    requestAnimationFrame(this._renderLoop);

    const deltaTime = this.clock.getDelta() * 1000;
    this.elapsedTime += deltaTime;

    // Simular posición del headset para preview
    const fakeHeadsetPosition = new THREE.Vector3(
      0, PANEL_HEIGHT_FROM_FLOOR, 0
    );

    // Actualizar panel (sin XR)
    this._updatePanel(fakeHeadsetPosition);

    // Renderizar
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Callback de redimensionamiento de ventana.
   */
  _onWindowResize() {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Inicia el render loop de preview (modo no-XR).
   * Muestra el panel en el navegador desktop.
   */
  startPreview() {
    if (!this.isInitialized) {
      console.error('[QuestWidgets] La aplicación no está inicializada');
      return;
    }

    // El preview se inicia automáticamente si no hay sesión XR
    this._renderLoop();
  }

  /**
   * Libera todos los recursos de la aplicación.
   */
  dispose() {
    window.removeEventListener('resize', this._onWindowResize);

    if (this.xrManager) {
      this.xrManager.dispose();
    }
    if (this.uiPanel) {
      this.uiPanel.dispose();
    }
    if (this.clockWidget) {
      this.clockWidget.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inicialización
// ─────────────────────────────────────────────────────────────────────────────

/** Instancia global de la aplicación */
const app = new QuestWidgetsApp();

/**
 * Inicia la aplicación cuando el DOM está listo.
 */
function main() {
  app.init().then(() => {
    // Iniciar preview en modo desktop (sin XR)
    // En Meta Quest, el usuario presionará el botón para iniciar XR
    app.startPreview();
  });
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

// Exportar para uso externo si es necesario
export { app };
