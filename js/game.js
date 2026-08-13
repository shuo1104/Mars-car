/**
 * Game Manager & Loop Handler for Mars Rover Explorer
 * Enhanced with Post-Processing Bloom Pipeline, ACES Tone Mapping, 3D Target HUD Markers & Dynamic FOV/Camera Shake
 */
class MarsGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.targetMarkersContainer = document.getElementById('target-markers-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.bloomPass = null;
        this.world = null;
        this.rover = null;
        this.clock = new THREE.Clock();

        // Game State
        this.cameraMode = 0; // 0: Chase, 1: POV, 2: Satellite
        this.battery = 100.0;
        this.solarPower = 0.0;
        this.collectedCount = 0;
        this.discoveredSamples = new Set();
        this.sandstormTimer = 0;
        this.isSandstorm = false;
        this.targetMarkersMap = new Map();

        // Input state
        this.inputs = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };

        // DOM elements
        this.dom = {
            batteryText: document.getElementById('battery-text'),
            batteryBar: document.getElementById('battery-bar'),
            solarText: document.getElementById('solar-text'),
            solarBar: document.getElementById('solar-bar'),
            speedVal: document.getElementById('speed-val'),
            pitchVal: document.getElementById('pitch-val'),
            rollVal: document.getElementById('roll-val'),
            navCoords: document.getElementById('nav-coords'),
            headlightStatus: document.getElementById('headlight-status'),
            driveMode: document.getElementById('drive-mode'),
            scanPanel: document.getElementById('scan-target-panel'),
            targetName: document.getElementById('target-name'),
            targetDist: document.getElementById('target-distance'),
            scanProgressBar: document.getElementById('scan-progress-bar'),
            sampleCountBadge: document.getElementById('sample-count-badge'),
            modalSampleCount: document.getElementById('modal-sample-count'),
            samplesGrid: document.getElementById('samples-grid'),
            alertBanner: document.getElementById('alert-banner'),
            sandstormOverlay: document.getElementById('sandstorm-overlay'),
            radarCanvas: document.getElementById('radar-canvas'),
            logModal: document.getElementById('log-modal'),
            helpModal: document.getElementById('help-modal')
        };

        this.radarCtx = this.dom.radarCanvas.getContext('2d');

        this.initThree();
        this.world = new MarsWorld(this.scene);
        this.rover = new MarsRover(this.scene);

        this.setupInputs();
        this.setupUIHandlers();
        this.init3DTargetHUD();

        // Start render loop
        this.animate();

        // Welcome help modal on start
        setTimeout(() => this.toggleModal(this.dom.helpModal, true), 500);
    }

    initThree() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Cinematic ACES Filmic Tone Mapping & Color Grading
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;

        this.container.appendChild(this.renderer.domElement);

        // Setup EffectComposer Bloom Pipeline if Three.js postprocessing modules are loaded
        if (typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
            try {
                this.composer = new THREE.EffectComposer(this.renderer);
                const renderPass = new THREE.RenderPass(this.scene, this.camera);
                this.composer.addPass(renderPass);

                this.bloomPass = new THREE.UnrealBloomPass(
                    new THREE.Vector2(window.innerWidth, window.innerHeight),
                    0.65, // bloom strength
                    0.4,  // radius
                    0.85  // threshold
                );
                this.composer.addPass(this.bloomPass);
            } catch (err) {
                console.warn("Post-processing setup warning:", err);
                this.composer = null;
            }
        }

        window.addEventListener('resize', () => this.onWindowResize());
    }

    init3DTargetHUD() {
        if (!this.targetMarkersContainer) return;
        this.targetMarkersContainer.innerHTML = '';
        this.targetMarkersMap.clear();

        // Markers are created dynamically once world samples are ready
        setTimeout(() => {
            if (!this.world || !this.world.samples) return;
            this.world.samples.forEach(sample => {
                const el = document.createElement('div');
                el.className = 'world-target-marker hidden';
                el.id = `target-marker-${sample.id}`;
                el.innerHTML = `
                    <div class="marker-reticle">
                        <div class="marker-dot"></div>
                    </div>
                    <div class="marker-info">
                        <span class="marker-tag">TARGET</span>
                        <span class="marker-title">${sample.name}</span>
                        <span class="marker-dist">--m</span>
                    </div>
                `;
                this.targetMarkersContainer.appendChild(el);
                this.targetMarkersMap.set(sample.id, el);
            });
        }, 100);
    }

    update3DTargetHUD() {
        if (!this.world || !this.world.samples) return;

        const camera = this.camera;
        const widthHalf = window.innerWidth / 2;
        const heightHalf = window.innerHeight / 2;
        const tempVec = new THREE.Vector3();
        const activeTarget = this.rover.scanTarget;

        this.world.samples.forEach(s => {
            const markerEl = this.targetMarkersMap.get(s.id);
            if (!markerEl) return;

            if (s.collected) {
                markerEl.classList.add('hidden');
                return;
            }

            tempVec.set(s.pos.x, s.y + 1.8, s.pos.z);
            const dist = this.rover.position.distanceTo(tempVec);

            // Project 3D vector to 2D Screen Space
            tempVec.project(camera);

            const isBehind = tempVec.z > 1.0;
            const isOutOfRange = dist > 60;

            if (isBehind || isOutOfRange) {
                markerEl.classList.add('hidden');
            } else {
                const screenX = (tempVec.x * widthHalf) + widthHalf;
                const screenY = -(tempVec.y * heightHalf) + heightHalf;

                markerEl.style.left = `${screenX}px`;
                markerEl.style.top = `${screenY}px`;
                markerEl.classList.remove('hidden');

                const distEl = markerEl.querySelector('.marker-dist');
                if (distEl) distEl.textContent = `${dist.toFixed(1)}m`;

                if (activeTarget && activeTarget.id === s.id) {
                    markerEl.classList.add('active-target');
                } else {
                    markerEl.classList.remove('active-target');
                }
            }
        });
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

            if (e.code === 'KeyC') this.cycleCameraView();
            if (e.code === 'KeyL') this.toggleHeadlights();
            if (e.code === 'KeyR') this.toggleSolarChargeMode();
            if (e.code === 'KeyE') this.triggerSampleScan();
            if (e.code === 'KeyH') this.toggleModal(this.dom.helpModal);
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

        document.getElementById('btn-action-e')?.addEventListener('click', () => this.triggerSampleScan());
        document.getElementById('btn-action-r')?.addEventListener('click', () => this.toggleSolarChargeMode());
        document.getElementById('btn-action-c')?.addEventListener('click', () => this.cycleCameraView());
    }

    setupUIHandlers() {
        document.getElementById('btn-logbook').addEventListener('click', () => {
            window.roverAudio.playUIClick();
            this.toggleModal(this.dom.logModal);
        });

        document.getElementById('btn-audio').addEventListener('click', () => {
            const enabled = window.roverAudio.toggleAudio();
            document.getElementById('btn-audio').style.borderColor = enabled ? '#00e5ff' : '#ff3b30';
        });

        document.getElementById('btn-help').addEventListener('click', () => {
            window.roverAudio.playUIClick();
            this.toggleModal(this.dom.helpModal);
        });

        document.getElementById('btn-close-log').addEventListener('click', () => this.toggleModal(this.dom.logModal, false));
        document.getElementById('btn-close-help').addEventListener('click', () => this.toggleModal(this.dom.helpModal, false));

        // Tab Switching in Log Modal
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                window.roverAudio.playUIClick();
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const targetTab = tab.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`tab-${targetTab}`).classList.remove('hidden');
            });
        });
    }

    toggleModal(modalEl, forceState) {
        const isHidden = modalEl.classList.contains('hidden');
        const show = forceState !== undefined ? forceState : isHidden;
        if (show) modalEl.classList.remove('hidden');
        else modalEl.classList.add('hidden');
    }

    cycleCameraView() {
        window.roverAudio.playUIClick();
        this.cameraMode = (this.cameraMode + 1) % 3;
    }

    toggleHeadlights() {
        window.roverAudio.playUIClick();
        const state = !this.rover.headlightsOn;
        this.rover.setHeadlights(state);
        this.dom.headlightStatus.textContent = state ? "开启 [L]" : "关闭 [L]";
        this.dom.headlightStatus.className = `val ${state ? 'badge-on' : 'badge-off'}`;
    }

    toggleSolarChargeMode() {
        window.roverAudio.playUIClick();
        const charging = !this.rover.isChargingMode;
        this.rover.setChargingMode(charging);
        this.dom.driveMode.textContent = charging ? "太阳能充能 CHARGE" : "标准 EXPLORE";
        this.dom.driveMode.className = `val ${charging ? 'charge' : 'highlight'}`;
        if (charging) {
            this.showTemporaryAlert("☀️ 提示：展开太阳能电池板", "原地停靠并收集光照能量充能中...", 3000);
        }
    }

    triggerSampleScan() {
        if (!this.rover.scanTarget || this.rover.isScanning) return;

        window.roverAudio.playScanSound();
        this.rover.isScanning = true;
        this.rover.scanProgress = 0;

        const scanInterval = setInterval(() => {
            this.rover.scanProgress += 12;
            this.dom.scanProgressBar.style.width = `${this.rover.scanProgress}%`;

            if (this.rover.scanTarget) {
                this.world.triggerScanSparks(this.rover.scanTarget.mesh.position);
            }

            if (this.rover.scanProgress >= 100) {
                clearInterval(scanInterval);
                this.completeSampleCollection(this.rover.scanTarget);
                this.rover.isScanning = false;
                this.world.hideScanSparks();
            }
        }, 120);
    }

    completeSampleCollection(sample) {
        if (!sample || sample.collected) return;
        sample.collected = true;
        sample.mesh.visible = false;
        sample.beacon.visible = false;
        if (sample.hologramRing) sample.hologramRing.visible = false;

        this.collectedCount++;
        this.discoveredSamples.add(sample.id);

        this.dom.sampleCountBadge.textContent = `${this.collectedCount} / ${this.world.samples.length}`;
        this.dom.modalSampleCount.textContent = this.collectedCount;

        // Render card into scientific discoveries modal
        const card = document.createElement('div');
        card.className = 'sample-card discovered';
        card.innerHTML = `
            <div class="type">${sample.type}</div>
            <div class="name">${sample.name}</div>
            <div class="desc">${sample.desc}</div>
        `;
        this.dom.samplesGrid.appendChild(card);

        this.showTemporaryAlert("🎉 样本收集成功！", `分析完成: ${sample.name}`, 4000);
        this.dom.scanPanel.classList.add('hidden');
    }

    showTemporaryAlert(title, msg, duration = 3500) {
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-msg').textContent = msg;
        this.dom.alertBanner.classList.remove('hidden');

        if (this.alertTimeout) clearTimeout(this.alertTimeout);
        this.alertTimeout = setTimeout(() => {
            this.dom.alertBanner.classList.add('hidden');
        }, duration);
    }

    updateBatteryAndPower(deltaTime) {
        if (this.rover.isChargingMode) {
            const stormPenalty = this.isSandstorm ? 0.35 : 1.0;
            this.solarPower = 4.8 * stormPenalty;
            this.battery = Math.min(100.0, this.battery + this.solarPower * deltaTime * 1.5);
        } else {
            this.solarPower = 0.0;
            const drainRate = (Math.abs(this.rover.speed) > 0.5 ? 0.4 : 0.08) + (this.rover.headlightsOn ? 0.15 : 0);
            this.battery = Math.max(0.0, this.battery - drainRate * deltaTime);
        }

        this.dom.batteryText.textContent = `${Math.round(this.battery)}%`;
        this.dom.batteryBar.style.width = `${this.battery}%`;
        this.dom.solarText.textContent = `${this.solarPower.toFixed(1)} kW/h`;
        this.dom.solarBar.style.width = `${(this.solarPower / 6.0) * 100}%`;
    }

    updateSandstormSystem(deltaTime) {
        this.sandstormTimer += deltaTime;
        if (!this.isSandstorm && this.sandstormTimer > 90) {
            this.isSandstorm = true;
            this.sandstormTimer = 0;
            this.world.setSandstorm(true);
            this.dom.sandstormOverlay.classList.add('active');
            this.showTemporaryAlert("⚠️ 警告：强烈火星沙尘暴来袭", "能见度急剧下降，太阳能面板充电效率降低！", 6000);
        } else if (this.isSandstorm && this.sandstormTimer > 25) {
            this.isSandstorm = false;
            this.sandstormTimer = 0;
            this.world.setSandstorm(false);
            this.dom.sandstormOverlay.classList.remove('active');
            this.showTemporaryAlert("☀️ 提示：沙尘暴过境", "大气尘埃开始消散，天空恢复清朗。", 4000);
        }
    }

    checkScanTarget() {
        const roverPos = this.rover.position;
        let nearestSample = null;
        let minDist = Infinity;

        this.world.samples.forEach(s => {
            if (!s.collected) {
                const dist = Math.hypot(roverPos.x - s.pos.x, roverPos.z - s.pos.z);
                if (dist < minDist) {
                    minDist = dist;
                    nearestSample = s;
                }
            }
        });

        if (nearestSample && minDist < 10.0) {
            this.rover.scanTarget = nearestSample;
            this.dom.scanPanel.classList.remove('hidden');
            this.dom.targetName.textContent = nearestSample.name;
            this.dom.targetDist.textContent = `距离: ${minDist.toFixed(1)} 米`;
        } else {
            this.rover.scanTarget = null;
            this.dom.scanPanel.classList.add('hidden');
            this.dom.scanProgressBar.style.width = '0%';
            this.world.hideScanSparks();
        }
    }

    updateCamera() {
        const rPos = this.rover.position;
        const rRot = this.rover.rotation;

        // Dynamic FOV kick based on speed
        const speedRatio = Math.abs(this.rover.speed) / this.rover.maxSpeed;
        const targetFov = 60 + speedRatio * 8;
        this.camera.fov += (targetFov - this.camera.fov) * 0.08;

        // Subtle Camera shake during high speed offroad or sandstorm
        let shakeX = 0, shakeY = 0;
        if (speedRatio > 0.6 || this.isSandstorm) {
            const intensity = (speedRatio > 0.6 ? 0.08 : 0) + (this.isSandstorm ? 0.12 : 0);
            shakeX = (Math.random() - 0.5) * intensity;
            shakeY = (Math.random() - 0.5) * intensity;
        }

        this.camera.updateProjectionMatrix();

        if (this.cameraMode === 0) { // Chase view
            const offset = new THREE.Vector3(
                Math.sin(rRot) * (8.5 + speedRatio * 1.2) + shakeX,
                3.8 + shakeY,
                Math.cos(rRot) * (8.5 + speedRatio * 1.2) + shakeX
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

    renderRadar() {
        const ctx = this.radarCtx;
        const w = 160, h = 160;
        ctx.clearRect(0, 0, w, h);

        const center = w / 2;
        const scale = 0.8;

        const rPos = this.rover.position;

        this.world.samples.forEach(s => {
            if (!s.collected) {
                const dx = (s.pos.x - rPos.x) * scale;
                const dz = (s.pos.z - rPos.z) * scale;

                const mapX = center + dx;
                const mapY = center + dz;

                if (Math.hypot(dx, dz) < center - 8) {
                    ctx.beginPath();
                    ctx.arc(mapX, mapY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = `#${s.color.toString(16).padStart(6, '0')}`;
                    ctx.fill();
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ffd166';
                }
            }
        });

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(-this.rover.rotation);

        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(-5, 6);
        ctx.lineTo(5, 6);
        ctx.closePath();

        ctx.fillStyle = '#00e5ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00e5ff';
        ctx.fill();
        ctx.restore();
    }

    updateTelemetryUI() {
        this.dom.speedVal.textContent = Math.abs(this.rover.speed).toFixed(1);
        this.dom.pitchVal.textContent = `${(this.rover.pitch * (180 / Math.PI)).toFixed(1)}°`;
        this.dom.rollVal.textContent = `${(this.rover.roll * (180 / Math.PI)).toFixed(1)}°`;

        this.dom.navCoords.textContent = `X: ${Math.round(this.rover.position.x)} | Z: ${Math.round(this.rover.position.z)}`;
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

        this.rover.update(deltaTime, this.inputs, (x, z) => this.world.getTerrainHeight(x, z));
        this.world.update(deltaTime);

        // Emit wheel dust particles when driving
        if (Math.abs(this.rover.speed) > 1.2) {
            this.world.triggerWheelDust(this.rover.position, this.rover.speed);
        }

        this.updateBatteryAndPower(deltaTime);
        this.updateSandstormSystem(deltaTime);
        this.checkScanTarget();
        this.update3DTargetHUD();

        window.roverAudio.updateEngineSound(this.rover.speed, this.inputs.forward || this.inputs.backward);

        this.updateCamera();
        this.renderRadar();
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
