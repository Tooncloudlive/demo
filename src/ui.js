/**
 * ============================================================================
 * ui.js — Componentes de Interfaz 3D (Glassmorphism)
 * ============================================================================
 *
 * Este módulo crea los elementos visuales 3D del panel flotante:
 * - Panel principal con efecto glassmorphism (cristal translúcido)
 * - Botón "Recentrar"
 * - Sombras y reflejos
 * - Efectos visuales de hover y presión
 *
 * Responsabilidades:
 * - Crear geometrías del panel con esquinas redondeadas
 * - Generar materiales shader para el efecto cristal
 * - Crear botón interactivo con estados visual
 * - Gestión de animaciones visuales (hover, press, recenter)
 * ============================================================================
 */

import * as THREE from 'three';
import {
  PANEL_WIDTH,
  PANEL_HEIGHT,
  PANEL_DEPTH,
  PANEL_CORNER_RADIUS,
  GLASS_OPACITY,
  GLASS_BORDER_OPACITY,
  GLASS_HIGHLIGHT_OPACITY,
  SHADOW_COLOR,
  SHADOW_OPACITY,
  BUTTON_TEXT_COLOR,
  BUTTON_NORMAL_BG,
  BUTTON_HOVER_BG,
  FONT_SIZE_BUTTON,
  FONT_FAMILY,
  HOVER_SCALE,
  PRESS_SCALE,
  easeOutCubic
} from './config.js';

/**
 * Clase UIPanel — Panel flotante con efecto glassmorphism
 *
 * Crea un panel 3D con:
 * - Fondo translúcido con reflejo Fresnel en los bordes
 * - Highlight superior para simular refracción de luz
 * - Borde blanco sutil
 * - Sombra proyectada debajo
 */
export class UIPanel {
  /**
   * @param {THREE.Scene} scene — Escena de Three.js
   */
  constructor(scene) {
    this.scene = scene;

    // Grupo principal que contiene todo el panel
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Estado visual
    this.currentScale = 1.0;
    this.targetScale = 1.0;
    this.isHovering = false;
    this.isPressed = false;

    // Animación de fade-in
    this.fadeInProgress = 0;
    this.isFadingIn = true;

    // Botón recenter
    this.recenterButton = null;
    this.onRecenterCallback = null;

    // Construir elementos visuales
    this.createPanelMesh();
    this.createShadowMesh();
    this.createRecenterButton();
  }

  /**
   * Crea el mesh principal del panel con efecto glassmorphism.
   *
   * Utiliza una geometría plana con esquinas redondeadas y un
   * ShaderMaterial personalizado que simula el efecto de cristal.
   */
  createPanelMesh() {
    // Geometría plana con esquinas redondeadas
    // Usamos ShapeGeometry para crear un rectángulo con esquinas redondeadas
    const shape = new THREE.Shape();
    const w = PANEL_WIDTH / 2;
    const h = PANEL_HEIGHT / 2;
    const r = Math.min(PANEL_CORNER_RADIUS / 1000, w * 0.3); // Radio en metros

    // Dibujar rectángulo redondeado
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);

    const geometry = new THREE.ShapeGeometry(shape);

    // ── Shader personalizado para glassmorphism ──
    // Este shader crea el efecto de cristal translúcido con:
    // - Fondo blanco semi-transparente
    // - Reflejo Fresnel en los bordes (más brillante en los bordes)
    // - Gradiente de luz superior
    // - Borde sutil
    const material = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: GLASS_OPACITY },
        uBorderOpacity: { value: GLASS_BORDER_OPACITY },
        uHighlightOpacity: { value: GLASS_HIGHLIGHT_OPACITY },
        uFadeIn: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;

        uniform float uOpacity;
        uniform float uBorderOpacity;
        uniform float uHighlightOpacity;
        uniform float uFadeIn;

        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vec2 uv = vUv;

          // ── Fondo base translúcido ──
          vec4 baseColor = vec4(1.0, 1.0, 1.0, uOpacity);

          // ── Borde sutil ──
          // Calcular distancia al borde más cercano
          float edgeDist = min(
            min(uv.x, 1.0 - uv.x),
            min(uv.y, 1.0 - uv.y)
          );
          // Suavizar el borde
          float borderMask = smoothstep(0.0, 0.08, edgeDist);
          // Invertir para obtener solo el borde
          float border = 1.0 - borderMask;
          // Aplicar color del borde
          vec4 borderColor = vec4(1.0, 1.0, 1.0, uBorderOpacity * border);

          // ── Highlight superior (simula luz entrando por arriba) ──
          float topGradient = smoothstep(0.0, 0.35, 1.0 - uv.y);
          vec4 highlightColor = vec4(1.0, 1.0, 1.0, uHighlightOpacity * topGradient * 0.4);

          // ── Fresnel en los bordes (brillo según ángulo de vista) ──
          // Simulado con gradiente radial desde el centro
          vec2 center = vec2(0.5, 0.5);
          float distFromCenter = length(uv - center);
          float fresnel = smoothstep(0.3, 0.7, distFromCenter) * 0.15;
          vec4 fresnelColor = vec4(1.0, 1.0, 1.0, fresnel);

          // ── Composición final ──
          vec4 finalColor = baseColor;
          finalColor = mix(finalColor, borderColor, borderColor.a);
          finalColor = mix(finalColor, highlightColor, highlightColor.a);
          finalColor = mix(finalColor, fresnelColor, fresnelColor.a);

          // Aplicar fade-in global
          finalColor.a *= uFadeIn;

          gl_FragColor = finalColor;
        }
      `
    });

    this.panelMesh = new THREE.Mesh(geometry, material);
    // Posicionar ligeramente adelante para el texto
    this.panelMesh.position.z = 0;
    this.group.add(this.panelMesh);
  }

  /**
   * Crea una sombra proyectada debajo del panel.
   * Simula una sombra suave difusa en el suelo.
   */
  createShadowMesh() {
    // Geometría de sombra (óvalo suave)
    const shadowGeometry = new THREE.PlaneGeometry(
      PANEL_WIDTH * 1.1,
      PANEL_HEIGHT * 0.6
    );

    const shadowMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uShadowOpacity: { value: SHADOW_OPACITY },
        uFadeIn: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uShadowOpacity;
        uniform float uFadeIn;
        varying vec2 vUv;

        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = length(vUv - center);
          // Gradiente radial suave
          float shadow = smoothstep(0.5, 0.0, dist) * uShadowOpacity;
          shadow *= uFadeIn;
          gl_FragColor = vec4(0.0, 0.0, 0.0, shadow);
        }
      `
    });

    this.shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
    // Posicionar debajo del panel, rotado para estar en el suelo
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = -PANEL_HEIGHT / 2 - 0.05;
    this.shadowMesh.position.z = 0.1;
    this.group.add(this.shadowMesh);
  }

  /**
   * Crea el botón "Recentrar" como un mesh 3D interactivo.
   */
  createRecenterButton() {
    const buttonWidth = 0.12;
    const buttonHeight = 0.035;
    const cornerRadius = 0.008;

    // Geometría del botón (rectángulo redondeado)
    const shape = new THREE.Shape();
    const w = buttonWidth / 2;
    const h = buttonHeight / 2;
    const r = cornerRadius;

    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);

    const geometry = new THREE.ShapeGeometry(shape);

    // Material del botón
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uBgOpacity: { value: parseFloat(BUTTON_NORMAL_BG.match(/[\d.]+/)[0]) },
        uBorderOpacity: { value: 0.2 },
        uFadeIn: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform float uBgOpacity;
        uniform float uBorderOpacity;
        uniform float uFadeIn;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;

          // Fondo del botón
          vec4 bgColor = vec4(1.0, 1.0, 1.0, uBgOpacity);

          // Borde sutil
          float edgeDist = min(
            min(uv.x, 1.0 - uv.x),
            min(uv.y, 1.0 - uv.y)
          );
          float border = 1.0 - smoothstep(0.0, 0.12, edgeDist);
          vec4 borderColor = vec4(1.0, 1.0, 1.0, uBorderOpacity * border);

          vec4 finalColor = mix(bgColor, borderColor, borderColor.a);
          finalColor.a *= uFadeIn;

          gl_FragColor = finalColor;
        }
      `
    });

    this.buttonMesh = new THREE.Mesh(geometry, material);
    this.buttonMesh.position.set(0, -PANEL_HEIGHT / 2 + 0.06, PANEL_DEPTH / 2 + 0.002);
    this.buttonMesh.visible = false; // Oculto por defecto
    this.group.add(this.buttonMesh);

    // Texto del botón
    this.createButtonText();
  }

  /**
   * Crea la textura de texto para el botón.
   */
  createButtonText() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `500 ${FONT_SIZE_BUTTON}px ${FONT_FAMILY}`;
    ctx.fillStyle = BUTTON_TEXT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Recentrar', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });

    const geometry = new THREE.PlaneGeometry(0.10, 0.025);
    this.buttonTextMesh = new THREE.Mesh(geometry, material);
    this.buttonTextMesh.position.set(0, 0, 0.001);
    this.buttonMesh.add(this.buttonTextMesh);
  }

  /**
   * Muestra u oculta el botón de recentrado.
   * @param {boolean} visible — true para mostrar, false para ocultar
   */
  setButtonVisible(visible) {
    this.buttonMesh.visible = visible;
  }

  /**
   * Establece el callback para el botón de recentrado.
   * @param {Function} callback — Función a llamar al presionar el botón
   */
  onRecenter(callback) {
    this.onRecenterCallback = callback;
  }

  /**
   * Simula la acción de presionar el botón (llamado desde main.js).
   */
  triggerRecenter() {
    if (this.onRecenterCallback) {
      this.onRecenterCallback();
    }
  }

  /**
   * Actualiza el estado visual del panel cada frame.
   * Gestiona: fade-in, hover scale, idle float, animations.
   *
   * @param {number} deltaTime — Tiempo transcurrido desde el frame anterior (ms)
   * @param {number} elapsedTime — Tiempo total transcurrido (ms)
   */
  update(deltaTime, elapsedTime) {
    // ── Fade-in de entrada ──
    if (this.isFadingIn) {
      this.fadeInProgress += deltaTime / 800; // 800ms para completar
      if (this.fadeInProgress >= 1.0) {
        this.fadeInProgress = 1.0;
        this.isFadingIn = false;
      }
      // Actualizar uniforms de fade-in
      const easeFade = easeOutCubic(this.fadeInProgress);
      if (this.panelMesh) {
        this.panelMesh.material.uniforms.uFadeIn.value = easeFade;
      }
      if (this.shadowMesh) {
        this.shadowMesh.material.uniforms.uFadeIn.value = easeFade;
      }
      if (this.buttonMesh) {
        this.buttonMesh.material.uniforms.uFadeIn.value = easeFade;
      }
    }

    // ── Animación de escala (hover / press) ──
    const lerpFactor = 0.12;
    this.currentScale += (this.targetScale - this.currentScale) * lerpFactor;
    this.group.scale.setScalar(this.currentScale);
  }

  /**
   * Activa el estado hover del panel.
   */
  setHover(active) {
    this.isHovering = active;
    this.targetScale = active ? HOVER_SCALE : 1.0;

    // Actualizar opacidad del botón en hover
    if (this.buttonMesh && this.buttonMesh.material) {
      const hoverOpacity = active
        ? parseFloat(BUTTON_HOVER_BG.match(/[\d.]+/)[0])
        : parseFloat(BUTTON_NORMAL_BG.match(/[\d.]+/)[0]);
      this.buttonMesh.material.uniforms.uBgOpacity.value +=
        (hoverOpacity - this.buttonMesh.material.uniforms.uBgOpacity.value) * 0.2;
    }
  }

  /**
   * Activa el estado de presión del panel.
   */
  setPressed(active) {
    this.isPressed = active;
    this.targetScale = active ? PRESS_SCALE : (this.isHovering ? HOVER_SCALE : 1.0);
  }

  /**
   * Establece la posición del panel en el espacio 3D.
   * @param {THREE.Vector3} position — Nueva posición
   */
  setPosition(position) {
    this.group.position.copy(position);
  }

  /**
   * Obtiene la posición actual del panel.
   * @returns {THREE.Vector3}
   */
  getPosition() {
    return this.group.position.clone();
  }

  /**
   * Hace que el panel mire hacia una posición (generalmente el usuario).
   * @param {THREE.Vector3} target — Posición a mirar
   */
  lookAt(target) {
    this.group.lookAt(target);
  }

  /**
   * Libera todos los recursos del panel.
   */
  dispose() {
    this.scene.remove(this.group);

    if (this.panelMesh) {
      this.panelMesh.geometry.dispose();
      this.panelMesh.material.dispose();
    }
    if (this.shadowMesh) {
      this.shadowMesh.geometry.dispose();
      this.shadowMesh.material.dispose();
    }
    if (this.buttonMesh) {
      this.buttonMesh.geometry.dispose();
      this.buttonMesh.material.dispose();
    }
    if (this.buttonTextMesh) {
      this.buttonTextMesh.geometry.dispose();
      this.buttonTextMesh.material.map?.dispose();
      this.buttonTextMesh.material.dispose();
    }
  }
}
