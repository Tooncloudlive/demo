/**
 * ============================================================================
 * clock.js — Widget de Reloj para Quest Widgets
 * ============================================================================
 *
 * Responsabilidades:
 * - Crear y gestionar la visualización de hora y fecha en el panel
 * - Actualizar la hora automáticamente cada segundo
 * - Formatear la hora según la configuración (12h / 24h)
 * - Formatear la fecha en español
 * - Renderizar texto como texturas Three.js usando Canvas
 * ============================================================================
 */

import * as THREE from 'three';
import {
  TIME_FORMAT,
  FONT_SIZE_TIME,
  FONT_SIZE_DATE,
  FONT_FAMILY,
  TEXT_PRIMARY_COLOR,
  TEXT_SECONDARY_COLOR,
  MONTHS_ES,
  DAYS_ES,
  PANEL_WIDTH,
  PANEL_PADDING
} from './config.js';

/**
 * Clase ClockWidget — Gestiona la visualización del reloj
 *
 * Crea texturas de Canvas para la hora y fecha, las convierte en
 * materiales Three.js y las aplica a meshes planos dentro del panel.
 */
export class ClockWidget {
  /**
   * @param {THREE.Scene} scene — Escena de Three.js donde se añadirán los meshes
   */
  constructor(scene) {
    this.scene = scene;

    // Grupo que contiene todos los elementos del reloj
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Meshes para hora y fecha
    this.timeMesh = null;
    this.dateMesh = null;

    // Intervalo de actualización
    this.updateInterval = null;

    // Canvas auxiliares para generar texturas
    this.timeCanvas = document.createElement('canvas');
    this.timeCtx = this.timeCanvas.getContext('2d');
    this.dateCanvas = document.createElement('canvas');
    this.dateCtx = this.dateCanvas.getContext('2d');

    // Inicializar
    this.createMeshes();
    this.startAutoUpdate();
  }

  /**
   * Crea los meshes de Three.js para la hora y la fecha.
   * Usa Canvas para renderizar texto en alta calidad y generar texturas.
   */
  createMeshes() {
    // ── Textura de la HORA ──
    const timeTexture = new THREE.CanvasTexture(this.timeCanvas);
    timeTexture.minFilter = THREE.LinearFilter;
    timeTexture.magFilter = THREE.LinearFilter;
    timeTexture.generateMipmaps = false;

    // Material con transparencia para el texto
    const timeMaterial = new THREE.MeshBasicMaterial({
      map: timeTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Geometría plana para la hora
    const timeWidth = PANEL_WIDTH - (PANEL_PADDING * 2);
    const timeHeight = timeWidth * 0.35; // Proporción del texto
    const timeGeometry = new THREE.PlaneGeometry(timeWidth, timeHeight);

    this.timeMesh = new THREE.Mesh(timeGeometry, timeMaterial);
    // Posicionar ligeramente por encima del centro del panel
    this.timeMesh.position.set(0, 0.025, PANEL_DEPTH / 2 + 0.001);
    this.group.add(this.timeMesh);

    // ── Textura de la FECHA ──
    const dateTexture = new THREE.CanvasTexture(this.dateCanvas);
    dateTexture.minFilter = THREE.LinearFilter;
    dateTexture.magFilter = THREE.LinearFilter;
    dateTexture.generateMipmaps = false;

    const dateMaterial = new THREE.MeshBasicMaterial({
      map: dateTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const dateWidth = timeWidth;
    const dateHeight = dateWidth * 0.12;
    const dateGeometry = new THREE.PlaneGeometry(dateWidth, dateHeight);

    this.dateMesh = new THREE.Mesh(dateGeometry, dateMaterial);
    // Posicionar debajo de la hora
    this.dateMesh.position.set(0, -0.055, PANEL_DEPTH / 2 + 0.001);
    this.group.add(this.dateMesh);
  }

  /**
   * Obtiene la hora actual formateada según la configuración.
   * @returns {string} Hora formateada (ej: "22:47" o "10:47 PM")
   */
  getFormattedTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();

    if (TIME_FORMAT === '12h') {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours === 0 ? 12 : hours;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    // Formato 24h
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Obtiene la fecha actual formateada en español.
   * @returns {string} Fecha formateada (ej: "Martes 14 de Julio")
   */
  getFormattedDate() {
    const now = new Date();
    const dayName = DAYS_ES[now.getDay()];
    const dayNumber = now.getDate();
    const monthName = MONTHS_ES[now.getMonth()];
    return `${dayName} ${dayNumber} de ${monthName}`;
  }

  /**
   * Renderiza el texto de la hora en el canvas auxiliar.
   * Genera una nueva textura y la aplica al mesh.
   */
  updateTimeTexture() {
    const timeText = this.getFormattedTime();
    const ctx = this.timeCtx;
    const canvas = this.timeCanvas;

    // Dimensiones del canvas (alta resolución para calidad)
    const width = 512;
    const height = 180;
    canvas.width = width;
    canvas.height = height;

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Configurar fuente
    ctx.font = `200 ${FONT_SIZE_TIME}px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_PRIMARY_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dibujar texto centrado
    ctx.fillText(timeText, width / 2, height / 2);

    // Actualizar textura
    if (this.timeMesh && this.timeMesh.material.map) {
      this.timeMesh.material.map.needsUpdate = true;
    }
  }

  /**
   * Renderiza el texto de la fecha en el canvas auxiliar.
   * Genera una nueva textura y la aplica al mesh.
   */
  updateDateTexture() {
    const dateText = this.getFormattedDate();
    const ctx = this.dateCtx;
    const canvas = this.dateCanvas;

    const width = 512;
    const height = 64;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    ctx.font = `400 ${FONT_SIZE_DATE}px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_SECONDARY_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Aplicar tracking (espaciado entre letras)
    ctx.letterSpacing = '0.02em';
    ctx.fillText(dateText, width / 2, height / 2);

    if (this.dateMesh && this.dateMesh.material.map) {
      this.dateMesh.material.map.needsUpdate = true;
    }
  }

  /**
   * Actualiza ambas texturas (hora y fecha).
   * Llama a este método cada segundo para mantener el reloj sincronizado.
   */
  update() {
    this.updateTimeTexture();
    this.updateDateTexture();
  }

  /**
   * Inicia la actualización automática cada segundo.
   * Almacena el intervalo para poder limpiarlo al destruir el widget.
   */
  startAutoUpdate() {
    // Actualizar inmediatamente
    this.update();

    // Y luego cada segundo
    this.updateInterval = setInterval(() => {
      this.update();
    }, 1000);
  }

  /**
   * Posiciona el grupo del reloj dentro del panel.
   * @param {number} x — Posición X
   * @param {number} y — Posición Y
   * @param {number} z — Posición Z
   */
  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  /**
   * Añade el grupo del reloj a un Object3D padre (el panel).
   * @param {THREE.Object3D} parent — Objeto padre
   */
  attachTo(parent) {
    parent.add(this.group);
  }

  /**
   * Libera todos los recursos del widget.
   * Limpia intervalos, geometrías, materiales y texturas.
   */
  dispose() {
    // Limpiar intervalo
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Liberar geometrías
    if (this.timeMesh) {
      this.timeMesh.geometry.dispose();
      this.timeMesh.material.map?.dispose();
      this.timeMesh.material.dispose();
      this.group.remove(this.timeMesh);
    }

    if (this.dateMesh) {
      this.dateMesh.geometry.dispose();
      this.dateMesh.material.map?.dispose();
      this.dateMesh.material.dispose();
      this.group.remove(this.dateMesh);
    }

    // Remover grupo de la escena
    this.scene.remove(this.group);
  }
}
