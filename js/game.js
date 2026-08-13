/**
 * Pure Game Manager for Mars Rover Explorer
 * Focuses 100% on WASD Infinite Driving & L Headlight Controls with Zero Forced Gameplay Modals
 */
class MarsGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.hudElement = document.getElementById('hud');

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.bloomPass = null;
        this.world = null;
        this.rover = null;
        this.clock = new THREE.Clock();

        // Camera State
        this.cameraMode = 0; // 0: Chase, 1: POV, 2: Overhead

        // Input state
        this.inputs = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };

        // Minimal DOM elements
        this.dom = {
            speedVal: document.getElementById('speed-val'),
            navCoords: document.getElementById('nav-coords'),
            headlightStatus: document.getElementById('headlight-status')
        };

        this.initThree();
        this.world = new MarsWorld(this.scene);
        this.rover = new MarsRover(this.scene);

        this.setupInputs();
        this.setupUIHandlers();

        // Start render loop immediately
        this.animate();
    }

    initThree() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            600
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // ACES Filmic Tone Mapping
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;

        this.container.appendChild(this.renderer.domElement);

        // EffectComposer Post-Processing Pipeline
        if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
            try {
                this.composer = new THREE.EffectComposer(this.renderer);
                const renderPass = new THREE.RenderPass(this.scene, this.camera);
                this.composer.addPass(renderPass);

                this.bloomPass = new THREE.UnrealBloomPass(
                    new THREE.Vector2(window.innerWidth, window.innerHeight),
                    0.65,
                    0.4,
                    0.85
                );
                this.composer.addPass(this.bloomPass);
            } catch (err) {
                console.warn("Post-processing warning:", err);
                this.composer = null;
            }
        }

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupInputs() {
        const keyMap = {
            'KeyW': 'forward', 'ArrowUp': 'forward',
            'KeyS': 'backward', 'ArrowDown': 'backward',
            'KeyA': 'left', 'ArrowLeft': 'left',
            'KeyD': 'right', 'ArrowRight': 'right',
            'Space': 'brake'
        };

        window.addEventListener('keydown', (e) => {
            window.roverAudio.init();
            window.roverAudio.resume();

            if (keyMap[e.code]) {
                this.inputs[keyMap[e.code]] = true;
            }

            if (e.code === 'KeyL') this.toggleHeadlights();
            if (e.code === 'KeyC') this.cycleCameraView();
        });

        window.addEventListener('keyup', (e) => {
            if (keyMap[e.code]) {
                this.inputs[keyMap[e.code]] = false;
            }
        });

        // Touch Control Bindings
        const bindTouchBtn = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            const start = (e) => { e.preventDefault(); window.roverAudio.init(); this.inputs[key] = true; };
            const end = (e) => { e.preventDefault(); this.inputs[key] = false; };
            el.addEventListener('touchstart', start);
            el.addEventListener('touchend', end);
            el.addEventListener('mousedown', start);
            el.addEventListener('mouseup', end);
        };

        bindTouchBtn('btn-up', 'forward');
        bindTouchBtn('btn-down', 'backward');
        bindTouchBtn('btn-left', 'left');
        bindTouchBtn('btn-right', 'right');

        document.getElementById('btn-action-l')?.addEventListener('click', () => this.toggleHeadlights());
        document.getElementById('btn-action-c')?.addEventListener('click', () => this.cycleCameraView());
    }

    setupUIHandlers() {
        document.getElementById('btn-audio')?.addEventListener('click', () => {
            const enabled = window.roverAudio.toggleAudio();
            const btn = document.getElementById('btn-audio');
            if (btn) btn.style.borderColor = enabled ? '#00e5ff' : '#ff3b30';
        });
    }

    cycleCameraView() {
        window.roverAudio.playUIClick();
        this.cameraMode = (this.cameraMode + 1) % 3;
    }

    toggleHeadlights() {
        window.roverAudio.playUIClick();
        const state = !this.rover.headlightsOn;
        this.rover.setHeadlights(state);
        if (this.dom.headlightStatus) {
            this.dom.headlightStatus.textContent = state ? "开启 [L]" : "关闭 [L]";
            this.dom.headlightStatus.className = `val ${state ? 'badge-on' : 'badge-off'}`;
        }
    }

    updateCamera() {
        const rPos = this.rover.position;
        const rRot = this.rover.rotation;

        const speedRatio = Math.abs(this.rover.speed) / this.rover.maxSpeed;
        const targetFov = 60 + speedRatio * 8.5;
        this.camera.fov += (targetFov - this.camera.fov) * 0.08;

        let shakeX = 0, shakeY = 0;
        if (speedRatio > 0.6 || this.rover.isDrifting) {
            const intensity = (speedRatio > 0.6 ? 0.09 : 0) + (this.rover.isDrifting ? 0.14 : 0);
            shakeX = (Math.random() - 0.5) * intensity;
            shakeY = (Math.random() - 0.5) * intensity;
        }

        this.camera.updateProjectionMatrix();

        if (this.cameraMode === 0) { // Chase view
            const offset = new THREE.Vector3(
                Math.sin(rRot) * (8.5 + speedRatio * 1.5) + shakeX,
                3.8 + shakeY,
                Math.cos(rRot) * (8.5 + speedRatio * 1.5) + shakeX
            );
            const targetCamPos = rPos.clone().add(offset);
            this.camera.position.lerp(targetCamPos, 0.12);
            this.camera.lookAt(rPos.clone().add(new THREE.Vector3(0, 1.2, 0)));
        } else if (this.cameraMode === 1) { // First Person POV
            const povPos = rPos.clone().add(new THREE.Vector3(
                -Math.sin(rRot) * 0.7 + shakeX * 0.5,
                2.3 + shakeY * 0.5,
                -Math.cos(rRot) * 0.7 + shakeX * 0.5
            ));
            this.camera.position.copy(povPos);
            const lookTarget = povPos.clone().add(new THREE.Vector3(
                -Math.sin(rRot) * 10,
                -0.5,
                -Math.cos(rRot) * 10
            ));
            this.camera.lookAt(lookTarget);
        } else if (this.cameraMode === 2) { // Satellite Overhead
            this.camera.position.set(rPos.x + shakeX, rPos.y + 48, rPos.z + 20 + shakeY);
            this.camera.lookAt(rPos);
        }
    }

    updateTelemetryUI() {
        const currentSpeed = Math.abs(this.rover.speed);
        if (this.dom.speedVal) this.dom.speedVal.textContent = currentSpeed.toFixed(1);
        if (this.dom.navCoords) this.dom.navCoords.textContent = `X: ${Math.round(this.rover.position.x)} | Z: ${Math.round(this.rover.position.z)}`;

        // Dynamic HUD Auto-Fade when driving
        if (currentSpeed > 2.0) {
            this.hudElement.classList.add('hud-driving');
        } else {
            this.hudElement.classList.remove('hud-driving');
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = Math.min(this.clock.getDelta(), 0.1);

        // Update Rover Physics & Infinite World relative to Rover Position
        this.rover.update(deltaTime, this.inputs, (x, z) => this.world.getTerrainHeight(x, z));
        this.world.update(deltaTime, this.rover.position);

        // Emit wheel dust particles & drift sand arcs
        if (Math.abs(this.rover.speed) > 1.2) {
            this.world.triggerWheelDust(this.rover.position, this.rover.speed, this.rover.isDrifting);
        }

        window.roverAudio.updateEngineSound(this.rover.speed, this.inputs.forward || this.inputs.backward);

        this.updateCamera();
        this.updateTelemetryUI();

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Initialize on window load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new MarsGame();
});
