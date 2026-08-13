/**
 * Game Manager & Loop Handler for Mars Rover Explorer
 */
class MarsGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
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

        this.container.appendChild(this.renderer.domElement);

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
        this.dom.driveMode.textContent = charging ? "充能 CHARGING" : "标准 EXPLORE";
        this.dom.driveMode.style.color = charging ? "#ffd166" : "#00e5ff";
    }

    triggerSampleScan() {
        if (!this.rover.scanTarget || this.rover.isScanning) return;

        if (this.battery < 8.0) {
            alert("⚠️ 电池电量不足！发射脉冲激光至少需要 8% 电量，请按 [R] 原地太阳能充电。");
            return;
        }

        this.battery -= 8.0;
        this.rover.isScanning = true;
        window.roverAudio.playLaserScan();

        let progress = 0;
        const interval = setInterval(() => {
            progress += 20;
            this.dom.scanProgressBar.style.width = `${progress}%`;

            if (progress >= 100) {
                clearInterval(interval);
                this.rover.isScanning = false;
                this.collectSample(this.rover.scanTarget);
            }
        }, 120);
    }

    collectSample(sample) {
        if (sample.collected) return;

        sample.collected = true;
        sample.mesh.visible = false;
        sample.beacon.visible = false;

        this.discoveredSamples.add(sample.id);
        this.collectedCount++;

        window.roverAudio.playSampleCollected();

        // Update HUD & Modal Count
        this.dom.sampleCountBadge.textContent = `${this.collectedCount} / ${this.world.samples.length}`;
        this.dom.modalSampleCount.textContent = this.collectedCount;

        this.renderDiscoveryLogGrid();

        // Alert popup banner
        this.showTemporaryAlert("🔬 科学样本成功采集！", `已将【${sample.name}】数据同步至高空卫星与发现日志。`);
    }

    showTemporaryAlert(title, msg, duration = 4000) {
        this.dom.alertBanner.classList.remove('hidden');
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-msg').textContent = msg;

        setTimeout(() => {
            this.dom.alertBanner.classList.add('hidden');
        }, duration);
    }

    renderDiscoveryLogGrid() {
        this.dom.samplesGrid.innerHTML = '';
        this.world.samples.forEach(s => {
            const card = document.createElement('div');
            card.className = `sample-card ${s.collected ? 'discovered' : ''}`;
            card.innerHTML = `
                <div class="type">${s.collected ? s.type : '未检测样品'}</div>
                <div class="name">${s.collected ? s.name : '未知地理标记 ???'}</div>
                <div class="desc">${s.collected ? s.desc : '靠近雷达黄色标记点并按 [E] 键使用光谱激光扫描解锁。'}</div>
            `;
            this.dom.samplesGrid.appendChild(card);
        });
    }

    updateBatteryAndPower(deltaTime) {
        if (this.rover.isChargingMode) {
            // Solar Charge efficiency (less efficiently during sandstorm)
            const efficiency = this.isSandstorm ? 2.5 : 6.0;
            this.solarPower = efficiency;
            this.battery = Math.min(100.0, this.battery + efficiency * deltaTime);
        } else {
            this.solarPower = 0.2; // Trickle power from RTG
            // Driving drains battery proportional to speed
            const driveDrain = 0.2 + (Math.abs(this.rover.speed) / this.rover.maxSpeed) * 0.8;
            this.battery = Math.max(0.0, this.battery - driveDrain * deltaTime);
        }

        // Update DOM status bars
        this.dom.batteryText.textContent = `${Math.round(this.battery)}%`;
        this.dom.batteryBar.style.width = `${this.battery}%`;

        this.dom.solarText.textContent = `${this.solarPower.toFixed(1)} kW/h`;
        this.dom.solarBar.style.width = `${(this.solarPower / 6.0) * 100}%`;
    }

    updateSandstormSystem(deltaTime) {
        this.sandstormTimer += deltaTime;
        // Trigger sandstorm roughly every 100 seconds for 20s
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

        // Nearby scan radius = 10 meters
        if (nearestSample && minDist < 10.0) {
            this.rover.scanTarget = nearestSample;
            this.dom.scanPanel.classList.remove('hidden');
            this.dom.targetName.textContent = nearestSample.name;
            this.dom.targetDist.textContent = `距离: ${minDist.toFixed(1)} 米`;
        } else {
            this.rover.scanTarget = null;
            this.dom.scanPanel.classList.add('hidden');
            this.dom.scanProgressBar.style.width = '0%';
        }
    }

    updateCamera() {
        const rPos = this.rover.position;
        const rRot = this.rover.rotation;

        if (this.cameraMode === 0) {
            // Mode 0: Smooth Chase Cam
            const offset = new THREE.Vector3(
                Math.sin(rRot) * 8.5,
                3.8,
                Math.cos(rRot) * 8.5
            );
            const targetCamPos = rPos.clone().add(offset);
            this.camera.position.lerp(targetCamPos, 0.1);
            this.camera.lookAt(rPos.clone().add(new THREE.Vector3(0, 1.2, 0)));
        } else if (this.cameraMode === 1) {
            // Mode 1: Mastcam First-Person POV
            const povPos = rPos.clone().add(new THREE.Vector3(
                -Math.sin(rRot) * 0.7,
                2.3,
                -Math.cos(rRot) * 0.7
            ));
            this.camera.position.copy(povPos);
            const lookTarget = povPos.clone().add(new THREE.Vector3(
                -Math.sin(rRot) * 10,
                -0.5,
                -Math.cos(rRot) * 10
            ));
            this.camera.lookAt(lookTarget);
        } else if (this.cameraMode === 2) {
            // Mode 2: Satellite High Top-Down View
            this.camera.position.set(rPos.x, rPos.y + 45, rPos.z + 20);
            this.camera.lookAt(rPos);
        }
    }

    renderRadar() {
        const ctx = this.radarCtx;
        const w = 160, h = 160;
        ctx.clearRect(0, 0, w, h);

        const center = w / 2;
        const scale = 0.8; // Radar zoom factor

        const rPos = this.rover.position;

        // Draw Waypoint dots
        this.world.samples.forEach(s => {
            if (!s.collected) {
                const dx = (s.pos.x - rPos.x) * scale;
                const dz = (s.pos.z - rPos.z) * scale;

                const mapX = center + dx;
                const mapY = center + dz;

                // Render inside radar circle bounds
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

        // Draw Rover Position & Heading Triangle in Center
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
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = Math.min(this.clock.getDelta(), 0.1);

        this.rover.update(deltaTime, this.inputs, (x, z) => this.world.getTerrainHeight(x, z));
        this.world.update(deltaTime);

        this.updateBatteryAndPower(deltaTime);
        this.updateSandstormSystem(deltaTime);
        this.checkScanTarget();

        window.roverAudio.updateEngineSound(this.rover.speed, this.inputs.forward || this.inputs.backward);

        this.updateCamera();
        this.renderRadar();
        this.updateTelemetryUI();

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize on window load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new MarsGame();
});
