/* ============================================
   Glass Clock — Main Script
   visionOS-inspired glassmorphism clock
   ============================================ */

// ——— Utils ———

/**
 * Linear interpolation between two values.
 * @param start - Starting value
 * @param end - Target value
 * @param factor - Interpolation factor (0-1)
 * @returns Interpolated value
 */
const lerp = (start: number, end: number, factor: number): number =>
  start + (end - start) * factor;

/**
 * Clamp a value between min and max.
 */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// ——— DOM Elements ———

const glassPanel = document.getElementById('glassPanel') as HTMLElement;
const specularLayer = document.getElementById('specularLayer') as HTMLElement;
const clockTime = document.getElementById('clockTime') as HTMLTimeElement;
const clockDate = document.getElementById('clockDate') as HTMLParagraphElement;

// ——— Clock Module ———

/**
 * Clock module: updates time and date every second.
 * Only updates the DOM when the text actually changes.
 */
class Clock {
  private lastTimeText = '';
  private lastDateText = '';
  private readonly months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  private readonly days = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];

  constructor() {
    this.update();
    setInterval(() => this.update(), 1000);
  }

  /**
   * Update clock display. Only touches DOM when values change.
   */
  private update(): void {
    const now = new Date();

    // Format time: "10:42"
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeText = `${hours}:${minutes}`;

    // Format date: "Lunes / 7 Julio"
    const dayName = this.days[now.getDay()];
    const dayNumber = now.getDate();
    const monthName = this.months[now.getMonth()];
    const dateText = `${dayName} / ${dayNumber} ${monthName}`;

    // Update time only if changed (prevents unnecessary DOM writes)
    if (timeText !== this.lastTimeText) {
      this.animateTextChange(clockTime, timeText);
      this.lastTimeText = timeText;
    }

    // Update date only if changed
    if (dateText !== this.lastDateText) {
      clockDate.textContent = dateText;
      this.lastDateText = dateText;
    }
  }

  /**
   * Animate text change with a subtle crossfade.
   * Only the time element gets this treatment.
   */
  private animateTextChange(element: HTMLElement, newText: string): void {
    // Quick fade out
    element.style.transition = 'opacity 80ms ease-out';
    element.style.opacity = '0.7';

    requestAnimationFrame(() => {
      // Update text
      element.textContent = newText;

      // Fade back in
      requestAnimationFrame(() => {
        element.style.transition = 'opacity 150ms ease-in';
        element.style.opacity = '1';
      });
    });
  }
}

// ——— 3D Tilt Module ———

/**
 * Tilt module: applies 3D rotation to the glass panel
 * based on mouse position. Max rotation: ±5°.
 * Uses lerp for smooth, organic movement.
 */
class TiltEffect {
  private mouseX = 0.5; // Normalized 0-1
  private mouseY = 0.5;
  private currentRotateX = 0;
  private currentRotateY = 0;
  private targetRotateX = 0;
  private targetRotateY = 0;
  private readonly maxRotation = 5; // Max 5 degrees
  private readonly lerpFactor = 0.08;
  private isHovering = false;
  private animationId: number | null = null;

  constructor() {
    this.bindEvents();
    this.startLoop();
  }

  private bindEvents(): void {
    // Mouse move: calculate target rotation
    glassPanel.addEventListener('mousemove', (e) => {
      const rect = glassPanel.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) / rect.width;
      this.mouseY = (e.clientY - rect.top) / rect.height;

      // Calculate target rotation (invert Y for natural feel)
      this.targetRotateY = (this.mouseX - 0.5) * this.maxRotation * 2;
      this.targetRotateX = (this.mouseY - 0.5) * -this.maxRotation * 2;
    });

    // Mouse enter: start hover state
    glassPanel.addEventListener('mouseenter', () => {
      this.isHovering = true;
      glassPanel.style.transform = 'scale(1.02)';
    });

    // Mouse leave: reset
    glassPanel.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.targetRotateX = 0;
      this.targetRotateY = 0;
      glassPanel.style.transform = 'scale(1)';
    });
  }

  /**
   * Main animation loop: smooth interpolation of rotation.
   * Runs at display refresh rate (typically 60-120fps).
   */
  private startLoop(): void {
    const animate = () => {
      // Smooth interpolation towards target
      this.currentRotateX = lerp(
        this.currentRotateX,
        this.targetRotateX,
        this.lerpFactor
      );
      this.currentRotateY = lerp(
        this.currentRotateY,
        this.targetRotateY,
        this.lerpFactor
      );

      // Apply transform (GPU-accelerated)
      // Scale is handled separately via CSS transition on hover
      const scale = this.isHovering ? 1.02 : 1.0;
      glassPanel.style.transform = `
        perspective(1200px)
        rotateX(${this.currentRotateX}deg)
        rotateY(${this.currentRotateY}deg)
        scale(${scale})
      `;

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Cleanup animation loop.
   */
  destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// ——— Specular Highlight Module ———

/**
 * Specular module: moves a radial gradient light spot
 * following the cursor. Creates the "glass reflection" effect.
 */
class SpecularEffect {
  private currentX = 0;
  private currentY = 0;
  private targetX = 0;
  private targetY = 0;
  private readonly lerpFactor = 0.08;
  private animationId: number | null = null;

  constructor() {
    this.bindEvents();
    this.startLoop();
  }

  private bindEvents(): void {
    // Track mouse position relative to panel
    glassPanel.addEventListener('mousemove', (e) => {
      const rect = glassPanel.getBoundingClientRect();
      this.targetX = e.clientX - rect.left;
      this.targetY = e.clientY - rect.top;
    });

    // Reset position on leave
    glassPanel.addEventListener('mouseleave', () => {
      this.targetX = 0;
      this.targetY = 0;
    });
  }

  /**
   * Animation loop: smooth follow of cursor position.
   */
  private startLoop(): void {
    const animate = () => {
      // Smooth interpolation
      this.currentX = lerp(this.currentX, this.targetX, this.lerpFactor);
      this.currentY = lerp(this.currentY, this.targetY, this.lerpFactor);

      // Apply position
      specularLayer.style.left = `${this.currentX}px`;
      specularLayer.style.top = `${this.currentY}px`;

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Cleanup animation loop.
   */
  destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// ——— Initialization ———

/**
 * Initialize all modules when DOM is ready.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Start clock
  new Clock();

  // Start 3D tilt effect (desktop only)
  const isTouchDevice = window.matchMedia('(hover: none)').matches;
  
  if (!isTouchDevice) {
    new TiltEffect();
    new SpecularEffect();
  }

  // Log ready state
  console.log('🕐 Glass Clock initialized');
});
