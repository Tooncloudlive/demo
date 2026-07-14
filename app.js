/**
 * ============================================================================
 * Quest Widgets - Reloj Flotante
 * ============================================================================
 * Aplicacion WebXR para Meta Quest 3.
 * Widget de reloj con estetica Apple Vision Pro (glassmorphism).
 * 
 * Archivo principal: contiene toda la logica de la aplicacion.
 * Organizado en secciones modulares para facilitar la ampliacion
 * con nuevos widgets (cronometro, temporizador, calendario, etc.)
 * 
 * @version 1.0.0
 * @author Quest Widgets
 * ============================================================================
 */

// =============================================================================
// CONFIGURACION GLOBAL
// =============================================================================

/**
 * Objeto de configuracion central.
 * Modifica estos valores para personalizar el comportamiento.
 */
const CONFIG = {
    // Formato de hora: '24h' o '12h'
    timeFormat: '24h',
    
    // Distancia inicial del widget frente al usuario (metros)
    widgetDistance: 1.5,
    
    // Altura del widget respecto al suelo (metros)
    widgetHeight: 1.6,
    
    // Intervalo de actualizacion del reloj (milisegundos)
    clockUpdateInterval: 1000,
    
    // Animaciones
    animation: {
        // Duracion del fade in inicial (ms)
        fadeInDuration: 1200,
        // Duracion de la animacion de recentrado (ms)
        recenterDuration: 600,
        // Easing para animaciones suaves
        easing: 'easeOutCubic'
    },
    
    // Posicion inicial del widget
    initialPosition: { x: 0, y: 1.6, z: -1.5 },
    
    // Nombres de dias en espanol
    days: [
        'Domingo', 'Lunes', 'Martes', 'Miercoles', 
        'Jueves', 'Viernes', 'Sabado'
    ],
    
    // Nombres de meses en espanol
    months: [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ]
};

// =============================================================================
// ESTADO GLOBAL
// =============================================================================

/**
 * Estado mutable de la aplicacion.
 * Se actualiza durante la ejecucion.
 */
const STATE = {
    // Indica si el modo VR/WebXR esta activo
    isVRMode: false,
    
    // Indica si la escena ha cargado completamente
    isSceneLoaded: false,
    
    // Referencia al intervalo del reloj
    clockIntervalId: null,
    
    // Posicion actual del widget
    widgetPosition: { ...CONFIG.initialPosition },
    
    // Indica si el widget esta siendo arrastrado
    isDragging: false,
    
    // Entidad que esta siendo arrastrada
    draggedEntity: null,
    
    // Punto de inicio del arrastre
    dragStartPoint: null,
    
    // Posicion del widget al inicio del arrastre
    dragStartPosition: null
};

// =============================================================================
// UTILIDADES
// =============================================================================

/**
 * Formatea un numero con dos digitos (agrega cero a la izquierda).
 * @param {number} num - Numero a formatear
 * @returns {string} Numero formateado con dos digitos
 */
function padZero(num) {
    return num.toString().padStart(2, '0');
}

/**
 * Funcion de easing: easeOutCubic.
 * Produce una desaceleracion suave al final.
 * @param {number} t - Progreso normalizado (0 a 1)
 * @returns {number} Valor eased
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Interpola linealmente entre dos valores.
 * @param {number} start - Valor inicial
 * @param {number} end - Valor final
 * @param {number} t - Progreso normalizado (0 a 1)
 * @returns {number} Valor interpolado
 */
function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Interpola entre dos posiciones 3D.
 * @param {Object} start - Posicion inicial {x, y, z}
 * @param {Object} end - Posicion final {x, y, z}
 * @param {number} t - Progreso normalizado (0 a 1)
 * @returns {Object} Posicion interpolada {x, y, z}
 */
function lerpPosition(start, end, t) {
    return {
        x: lerp(start.x, end.x, t),
        y: lerp(start.y, end.y, t),
        z: lerp(start.z, end.z, t)
    };
}

// =============================================================================
// CLASE: ClockWidget
// =============================================================================

/**
 * Clase que gestiona el widget de reloj.
 * 
 * Responsabilidades:
 * - Actualizar la hora y fecha cada segundo
 * - Formatear la hora segun CONFIG.timeFormat
 * - Mostrar la fecha en espanol
 * 
 * Esta clase es el nucleo del primer widget. El sistema esta disenado
 * para que futuros widgets (TimerWidget, StopwatchWidget, etc.) sigan
 * el mismo patron de clase.
 */
class ClockWidget {
    constructor() {
        // Referencias a elementos DOM de A-Frame
        this.timeElement = document.querySelector('#clock-time');
        this.dateElement = document.querySelector('#clock-date');
        
        // Verificar que los elementos existen
        if (!this.timeElement || !this.dateElement) {
            console.error('[ClockWidget] Error: No se encontraron los elementos del reloj');
            return;
        }
        
        // Inicializar inmediatamente
        this.update();
        
        // Iniciar actualizacion periodica
        this.start();
        
        console.log('[ClockWidget] Reloj inicializado correctamente');
    }
    
    /**
     * Actualiza la hora y fecha mostradas.
     * Llama a los metodos de formateo correspondientes.
     */
    update() {
        const now = new Date();
        this.updateTime(now);
        this.updateDate(now);
    }
    
    /**
     * Actualiza el texto de la hora.
     * Soporta formatos 12h y 24h segun configuracion.
     * @param {Date} date - Objeto Date con la hora actual
     */
    updateTime(date) {
        if (!this.timeElement) return;
        
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let period = '';
        
        // Formato 12h: convertir hora y agregar AM/PM
        if (CONFIG.timeFormat === '12h') {
            period = hours >= 12 ? ' PM' : ' AM';
            hours = hours % 12;
            hours = hours === 0 ? 12 : hours;
        }
        
        // Formatear con dos digitos
        const hoursStr = padZero(hours);
        const minutesStr = padZero(minutes);
        
        // Actualizar el texto en la escena 3D
        this.timeElement.setAttribute('value', `${hoursStr}:${minutesStr}${period}`);
    }
    
    /**
     * Actualiza el texto de la fecha.
     * Formato: "Martes, 14 de julio"
     * @param {Date} date - Objeto Date con la fecha actual
     */
    updateDate(date) {
        if (!this.dateElement) return;
        
        const dayName = CONFIG.days[date.getDay()];
        const dayOfMonth = date.getDate();
        const monthName = CONFIG.months[date.getMonth()];
        
        // Formato: "Martes, 14 de julio"
        const dateString = `${dayName}, ${dayOfMonth} de ${monthName}`;
        
        this.dateElement.setAttribute('value', dateString);
    }
    
    /**
     * Inicia la actualizacion automatica cada segundo.
     */
    start() {
        // Limpiar intervalo anterior si existe
        if (STATE.clockIntervalId) {
            clearInterval(STATE.clockIntervalId);
        }
        
        // Crear nuevo intervalo
        STATE.clockIntervalId = setInterval(() => {
            this.update();
        }, CONFIG.clockUpdateInterval);
        
        console.log('[ClockWidget] Actualizacion automatica iniciada (cada 1s)');
    }
    
    /**
     * Detiene la actualizacion automatica.
     */
    stop() {
        if (STATE.clockIntervalId) {
            clearInterval(STATE.clockIntervalId);
            STATE.clockIntervalId = null;
            console.log('[ClockWidget] Actualizacion automatica detenida');
        }
    }
}

// =============================================================================
// CLASE: WidgetManager
// =============================================================================

/**
 * Gestiona la posicion, movimiento y comportamiento del widget en 3D.
 * 
 * Responsabilidades:
 * - Posicionar el widget frente al usuario
 * - Permitir arrastre con controladores VR
 * - Recentrar el widget al origen
 * - Animaciones de posicion suaves
 */
class WidgetManager {
    constructor() {
        // Referencia al contenedor del widget en la escena
        this.container = document.querySelector('#widget-container');
        this.panel = document.querySelector('#clock-panel');
        
        if (!this.container) {
            console.error('[WidgetManager] Error: No se encontro el contenedor del widget');
            return;
        }
        
        // Inicializar
        this.setupInteractions();
        this.setupAnimations();
        
        console.log('[WidgetManager] Gestor de widget inicializado');
    }
    
    /**
     * Configura las interacciones del widget.
     * - Arrastre con controladores
     * - Hover effects
     */
    setupInteractions() {
        if (!this.container) return;
        
        // ===== EVENTOS DE ARRASTRE =====
        
        // Inicio de arrastre: mousedown / grip down
        this.container.addEventListener('mousedown', (e) => this.onDragStart(e));
        this.container.addEventListener('triggerdown', (e) => this.onDragStart(e));
        
        // Durante arrastre: mousemove
        document.addEventListener('mousemove', (e) => this.onDragMove(e));
        
        // Fin de arrastre: mouseup / grip up
        document.addEventListener('mouseup', () => this.onDragEnd());
        document.addEventListener('triggerup', () => this.onDragEnd());
        
        // ===== EVENTOS DE HOVER =====
        
        // Entrada del cursor: escala ligera
        this.container.addEventListener('mouseenter', () => {
            if (!STATE.isDragging && this.panel) {
                this.panel.emit('hover-start');
            }
        });
        
        // Salida del cursor: volver a escala normal
        this.container.addEventListener('mouseleave', () => {
            if (!STATE.isDragging && this.panel) {
                this.panel.emit('hover-end');
            }
        });
        
        console.log('[WidgetManager] Interacciones configuradas');
    }
    
    /**
     * Configura las animaciones del widget.
     * - Fade in al iniciar
     * - Escala en hover
     * - Transiciones suaves
     */
    setupAnimations() {
        if (!this.container) return;
        
        // ===== ANIMACION FADE IN INICIAL =====
        this.container.setAttribute('animation__fadein', {
            property: 'opacity',
            from: 0,
            to: 1,
            dur: CONFIG.animation.fadeInDuration,
            easing: 'easeOutQuad'
        });
        
        // ===== ANIMACION DE ESCALA EN HOVER =====
        if (this.panel) {
            // Hover start: escala aumenta ligeramente
            this.panel.setAttribute('animation__hover-start', {
                property: 'scale',
                to: '1.03 1.03 1.03',
                dur: 250,
                easing: 'easeOutQuad',
                startEvents: 'hover-start'
            });
            
            // Hover end: escala vuelve a normal
            this.panel.setAttribute('animation__hover-end', {
                property: 'scale',
                to: '1 1 1',
                dur: 250,
                easing: 'easeOutQuad',
                startEvents: 'hover-end'
            });
        }
        
        console.log('[WidgetManager] Animaciones configuradas');
    }
    
    /**
     * Maneja el inicio del arrastre.
     * @param {Event} e - Evento de interaccion
     */
    onDragStart(e) {
        // Solo permitir arrastre con boton izquierdo o controlador VR
        if (e.type === 'mousedown' && e.button !== 0) return;
        
        STATE.isDragging = true;
        STATE.draggedEntity = this.container;
        
        // Guardar posicion inicial del widget
        const pos = this.container.getAttribute('position');
        STATE.dragStartPosition = { x: pos.x, y: pos.y, z: pos.z };
        
        // Guardar punto de interseccion del rayo
        if (e.detail && e.detail.intersection) {
            STATE.dragStartPoint = e.detail.intersection.point.clone();
        }
        
        console.log('[WidgetManager] Arrastre iniciado');
    }
    
    /**
     * Maneja el movimiento durante el arrastre.
     * Actualiza la posicion del widget segun el rayo del controlador.
     * @param {Event} e - Evento de movimiento
     */
    onDragMove(e) {
        if (!STATE.isDragging || !STATE.draggedEntity) return;
        
        // Para movimiento con raton en desktop
        if (e.type === 'mousemove') {
            // Calcular desplazamiento basado en movimiento del raton
            const sensitivity = 0.003;
            const dx = e.movementX * sensitivity;
            const dy = -e.movementY * sensitivity;
            
            const pos = STATE.draggedEntity.getAttribute('position');
            STATE.draggedEntity.setAttribute('position', {
                x: pos.x + dx,
                y: pos.y + dy,
                z: pos.z
            });
        }
    }
    
    /**
     * Maneja el fin del arrastre.
     */
    onDragEnd() {
        if (!STATE.isDragging) return;
        
        STATE.isDragging = false;
        STATE.draggedEntity = null;
        STATE.dragStartPoint = null;
        STATE.dragStartPosition = null;
        
        console.log('[WidgetManager] Arrastre finalizado');
    }
    
    /**
     * Recentra el widget a la posicion inicial frente al usuario.
     * Incluye animacion suave de transicion.
     */
    recenter() {
        if (!this.container) return;
        
        console.log('[WidgetManager] Recentrando widget...');
        
        // Obtener posicion actual
        const currentPos = this.container.getAttribute('position');
        const targetPos = { ...CONFIG.initialPosition };
        
        // Animacion de recentrado con lerp suave
        const startTime = performance.now();
        const duration = CONFIG.animation.recenterDuration;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutCubic(progress);
            
            // Interpolar posicion
            const newPos = lerpPosition(currentPos, targetPos, easedProgress);
            this.container.setAttribute('position', newPos);
            
            // Tambien resetear rotacion
            const currentRot = this.container.getAttribute('rotation');
            this.container.setAttribute('rotation', {
                x: lerp(currentRot.x, 0, easedProgress),
                y: lerp(currentRot.y, 0, easedProgress),
                z: lerp(currentRot.z, 0, easedProgress)
            });
            
            // Continuar animacion si no ha terminado
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Actualizar estado
                STATE.widgetPosition = { ...targetPos };
                console.log('[WidgetManager] Widget recentrado');
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * Muestra el widget con animacion de fade in.
     */
    show() {
        if (!this.container) return;
        this.container.setAttribute('visible', true);
        this.container.emit('fade-in');
    }
    
    /**
     * Oculta el widget.
     */
    hide() {
        if (!this.container) return;
        this.container.setAttribute('visible', false);
    }
}

// =============================================================================
// CLASE: ButtonManager
// =============================================================================

/**
 * Gestiona los botones interactivos del widget.
 * 
 * Responsabilidades:
 * - Configurar eventos de click en botones
 * - Gestionar el boton "Recentrar"
 * - Animaciones de feedback en botones
 */
class ButtonManager {
    constructor(widgetManager) {
        this.widgetManager = widgetManager;
        
        // Referencia al boton de recentrar
        this.recenterBtn = document.querySelector('#recenter-btn');
        
        if (!this.recenterBtn) {
            console.error('[ButtonManager] Error: No se encontro el boton de recentrar');
            return;
        }
        
        this.setupButtons();
        console.log('[ButtonManager] Botones inicializados');
    }
    
    /**
     * Configura los eventos de los botones.
     */
    setupButtons() {
        if (!this.recenterBtn) return;
        
        // ===== BOTON RECENTRAR =====
        
        // Click con raton
        this.recenterBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el click se propague al panel
            this.handleRecenter();
        });
        
        // Click con controlador VR (raycaster)
        this.recenterBtn.addEventListener('triggerdown', (e) => {
            e.stopPropagation();
            this.handleRecenter();
        });
        
        // Feedback visual en hover
        this.recenterBtn.addEventListener('mouseenter', () => {
            this.recenterBtn.emit('btn-hover-start');
        });
        
        this.recenterBtn.addEventListener('mouseleave', () => {
            this.recenterBtn.emit('btn-hover-end');
        });
        
        console.log('[ButtonManager] Eventos de botones configurados');
    }
    
    /**
     * Maneja la accion de recentrar.
     * Delega al WidgetManager para la animacion.
     */
    handleRecenter() {
        console.log('[ButtonManager] Boton Recentrar presionado');
        
        if (this.widgetManager) {
            this.widgetManager.recenter();
        }
    }
}

// =============================================================================
// CLASE: VRManager
// =============================================================================

/**
 * Gestiona el ciclo de vida del modo WebXR/VR.
 * 
 * Responsabilidades:
 * - Detectar soporte de WebXR
 * - Entrar/salir del modo VR
 * - Gestionar eventos de sesion XR
 * - Mostrar/ocultar elementos del overlay
 */
class VRManager {
    constructor() {
        this.scene = document.querySelector('a-scene');
        this.enterVRBtn = document.querySelector('#enter-vr-btn');
        this.loadingMsg = document.querySelector('#loading-msg');
        this.instructions = document.querySelector('#instructions');
        
        this.setupEventListeners();
        console.log('[VRManager] Gestor VR inicializado');
    }
    
    /**
     * Configura los event listeners para la sesion VR.
     */
    setupEventListeners() {
        if (!this.scene) return;
        
        // ===== EVENTOS DE LA ESCENA A-FRAME =====
        
        // Escena cargada y lista
        this.scene.addEventListener('loaded', () => {
            console.log('[VRManager] Escena cargada correctamente');
            STATE.isSceneLoaded = true;
            this.onSceneLoaded();
        });
        
        // Entrar a modo VR
        this.scene.addEventListener('enter-vr', () => {
            console.log('[VRManager] Modo VR activado');
            STATE.isVRMode = true;
            this.onEnterVR();
        });
        
        // Salir de modo VR
        this.scene.addEventListener('exit-vr', () => {
            console.log('[VRManager] Modo VR desactivado');
            STATE.isVRMode = false;
            this.onExitVR();
        });
        
        // ===== BOTON ENTRAR VR =====
        
        if (this.enterVRBtn) {
            this.enterVRBtn.addEventListener('click', () => {
                this.enterVR();
            });
        }
    }
    
    /**
     * Se ejecuta cuando la escena ha cargado completamente.
     */
    onSceneLoaded() {
        // Ocultar mensaje de carga
        if (this.loadingMsg) {
            this.loadingMsg.classList.add('hidden');
        }
        
        // Verificar si WebXR es soportado
        if (this.isWebXRSupported()) {
            console.log('[VRManager] WebXR soportado - Boton VR disponible');
            // El boton se muestra automaticamente por la animacion CSS
        } else {
            console.warn('[VRManager] WebXR no soportado en este navegador');
            if (this.enterVRBtn) {
                this.enterVRBtn.textContent = 'WebXR no soportado';
                this.enterVRBtn.disabled = true;
                this.enterVRBtn.style.opacity = '0.5';
            }
        }
    }
    
    /**
     * Se ejecuta al entrar al modo VR.
     */
    onEnterVR() {
        // Ocultar elementos del overlay que no se necesitan en VR
        if (this.enterVRBtn) {
            this.enterVRBtn.classList.add('hidden');
        }
        if (this.loadingMsg) {
            this.loadingMsg.classList.add('hidden');
        }
        
        // Mostrar instrucciones
        if (this.instructions) {
            this.instructions.classList.remove('hidden');
            this.instructions.classList.add('visible');
            
            // Ocultar instrucciones despues de unos segundos
            setTimeout(() => {
                this.instructions.classList.remove('visible');
                this.instructions.classList.add('hidden');
            }, 8000);
        }
        
        // Agregar clase CSS para estilos en modo XR
        this.scene.classList.add('xr-mode');
    }
    
    /**
     * Se ejecuta al salir del modo VR.
     */
    onExitVR() {
        // Mostrar boton VR nuevamente
        if (this.enterVRBtn) {
            this.enterVRBtn.classList.remove('hidden');
            this.enterVRBtn.classList.add('visible');
        }
        
        // Remover clase CSS de modo XR
        this.scene.classList.remove('xr-mode');
    }
    
    /**
     * Verifica si el navegador soporta WebXR.
     * @returns {boolean} true si WebXR esta soportado
     */
    isWebXRSupported() {
        return !!(navigator.xr && navigator.xr.isSessionSupported);
    }
    
    /**
     * Intenta entrar en modo VR/WebXR.
     */
    async enterVR() {
        if (!this.scene) return;
        
        try {
            // Verificar soporte de sesion immersiva
            const supported = await navigator.xr.isSessionSupported('immersive-vr');
            
            if (supported) {
                // Entrar a VR via A-Frame
                this.scene.enterVR();
                console.log('[VRManager] Entrando a modo VR...');
            } else {
                console.warn('[VRManager] Sesion immersive-vr no soportada');
                alert('Modo VR no soportado en este dispositivo');
            }
        } catch (error) {
            console.error('[VRManager] Error al entrar a VR:', error);
        }
    }
}

// =============================================================================
// CLASE: App (Controlador Principal)
// =============================================================================

/**
 * Clase principal de la aplicacion.
 * Coordina todos los modulos y gestiona el ciclo de vida.
 * 
 * Patron: Facade - proporciona una interfaz unificada para
 * todos los subsistemas de la aplicacion.
 * 
 * Escalabilidad: Para agregar nuevos widgets, extender el
 * metodo initWidgets() con nuevas instancias de clases Widget.
 */
class App {
    constructor() {
        // Modulos de la aplicacion
        this.clockWidget = null;
        this.widgetManager = null;
        this.buttonManager = null;
        this.vrManager = null;
        
        // Flag de inicializacion
        this.isInitialized = false;
    }
    
    /**
     * Inicializa la aplicacion completa.
     * Orden de inicializacion es importante.
     */
    init() {
        if (this.isInitialized) {
            console.warn('[App] La aplicacion ya esta inicializada');
            return;
        }
        
        console.log('============================================');
        console.log('  Quest Widgets - Reloj Flotante v1.0');
        console.log('  Modo hora:', CONFIG.timeFormat);
        console.log('============================================');
        
        // Esperar a que la escena A-Frame este lista
        const scene = document.querySelector('a-scene');
        
        if (scene && scene.hasLoaded) {
            // La escena ya cargo, inicializar ahora
            this.onSceneReady();
        } else if (scene) {
            // Esperar a que la escena cargue
            scene.addEventListener('loaded', () => this.onSceneReady());
        } else {
            console.error('[App] Error: No se encontro la escena A-Frame');
        }
        
        // Escuchar tecla R para recentrar (debug desktop)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                if (this.widgetManager) {
                    this.widgetManager.recenter();
                }
            }
        });
    }
    
    /**
     * Se ejecuta cuando la escena A-Frame esta lista.
     */
    onSceneReady() {
        console.log('[App] Escena lista - Inicializando modulos...');
        
        // 1. Inicializar gestor VR (siempre primero)
        this.vrManager = new VRManager();
        
        // 2. Inicializar widget de reloj
        this.clockWidget = new ClockWidget();
        
        // 3. Inicializar gestor de widget (posicion y movimiento)
        this.widgetManager = new WidgetManager();
        
        // 4. Inicializar gestor de botones
        this.buttonManager = new ButtonManager(this.widgetManager);
        
        this.isInitialized = true;
        
        console.log('[App] Aplicacion inicializada correctamente');
        console.log('[App] Presiona "R" para recentrar (debug desktop)');
    }
    
    /**
     * Metodo para agregar nuevos widgets en el futuro.
     * Ejemplo de uso:
     *   app.registerWidget('timer', new TimerWidget());
     * 
     * @param {string} name - Nombre identificador del widget
     * @param {Object} widget - Instancia del widget
     */
    registerWidget(name, widget) {
        if (!this.widgets) {
            this.widgets = {};
        }
        this.widgets[name] = widget;
        console.log(`[App] Widget registrado: ${name}`);
    }
    
    /**
     * Obtiene un widget registrado.
     * @param {string} name - Nombre del widget
     * @returns {Object|null} Instancia del widget o null
     */
    getWidget(name) {
        return this.widgets ? this.widgets[name] : null;
    }
    
    /**
     * Destruye la aplicacion y limpia recursos.
     */
    destroy() {
        console.log('[App] Destruyendo aplicacion...');
        
        if (this.clockWidget) {
            this.clockWidget.stop();
        }
        
        this.isInitialized = false;
        console.log('[App] Aplicacion destruida');
    }
}

// =============================================================================
// INICIALIZACION
// =============================================================================

/**
 * Punto de entrada de la aplicacion.
 * Se ejecuta cuando el DOM esta completamente cargado.
 * 
 * Escalabilidad: Para futuros widgets, la clase App ya tiene
 * el metodo registerWidget() preparado.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Main] DOM cargado - Iniciando Quest Widgets...');
    
    // Crear instancia global de la aplicacion
    window.app = new App();
    
    // Inicializar
    window.app.init();
});

/**
 * Manejo de errores globales.
 * Captura errores no manejados para evitar crash de la aplicacion.
 */
window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.message, 'en', e.filename, 'linea', e.lineno);
});

/**
 * Manejo de promesas rechazadas no capturadas.
 */
window.addEventListener('unhandledrejection', (e) => {
    console.error('[Unhandled Promise Rejection]', e.reason);
});

// =============================================================================
// EXPORT PARA TESTING (opcional)
// =============================================================================

// En entorno de testing, exportar las clases
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App, ClockWidget, WidgetManager, ButtonManager, VRManager, CONFIG, STATE };
}
