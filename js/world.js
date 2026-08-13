/**
 * Mars World Generator: Pure Infinite Procedural Terrain, Dynamic Sky, Volumetric Weather & Particle Systems
 * Features High-Granularity Mars Soil Normal Maps, Dual-Layer Wheel Sand Spray & Granular Volumetric Dust Plumes
 */
class MarsWorld {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.terrainSize = 380; // 380m x 380m viewport
        this.segments = 130;
        this.gridCenterX = 0;
        this.gridCenterZ = 0;

        this.dustParticles = null;
        this.sandstormActive = false;

        // Visual enhancement systems
        this.wheelDustSystem = null;
        this.wheelDustPositions = [];
        this.sandSparksSystem = null;
        this.sandSparksPositions = [];

        this.atmosphereDome = null;
        this.dayTime = 0.25; // 0 to 1 sol cycle (0.25 = sunrise/morning, 0.5 = solar noon, 0.75 = sunset)
        this.sunLight = null;
        this.ambientLight = null;

        // Astronomically Accurate Sun Objects
        this.sunGroup = null;
        this.sunDisk = null;
        this.sunHalo = null;
        this.blueSunsetHalo = null;

        // Rock pooling for infinite procedural scattering
        this.rockPool = [];
        this.maxRocks = 180;

        // High-Granularity Particle textures & procedural normal maps
        this.softParticleTexture = this.createSoftParticleTexture();
        this.granularDustTexture = this.createGranularDustTexture();
        this.sandGrainTexture = this.createSandGrainTexture();
        this.sunGlowTexture = this.createSunGlowTexture();
        this.blueAuraTexture = this.createBlueAuraTexture();
        this.proceduralTextures = this.createProceduralTerrainTextures();

        this.initLightingAndFog();
        this.initSkyAndMoons();
        this.initAtmosphereDome();
        this.initAstronomicalSun();
        this.initInfiniteTerrain();
        this.initRockPool();
        this.initDustParticles();
        this.initWheelDustSystem();
        this.initSandSparksSystem();
    }

    // Canvas 2D soft particle texture for volumetric ambient dust
    createSoftParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.25, 'rgba(255, 190, 140, 0.75)');
        grad.addColorStop(0.65, 'rgba(200, 90, 40, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    // Canvas 2D texture for Granular Dust Cloud Plumes with fine sand noise
    createGranularDustTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 220, 180, 0.95)');
        grad.addColorStop(0.3, 'rgba(230, 140, 70, 0.65)');
        grad.addColorStop(0.7, 'rgba(180, 80, 30, 0.15)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        // Add fine granular noise specks onto the particle texture
        const imgData = ctx.getImageData(0, 0, 128, 128);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 20) {
                const noise = (Math.random() - 0.5) * 35;
                data[i] = Math.min(255, Math.max(0, data[i] + noise));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    // Canvas 2D crisp sand grain texture for kickback gravel spray
    createSandGrainTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(255, 200, 150, 0.95)';
        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 240, 1.0)';
        ctx.beginPath();
        ctx.arc(14, 14, 4, 0, Math.PI * 2);
        ctx.fill();

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    // Canvas 2D texture for white/yellow Solar Corona Glow
    createSunGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 255, 240, 1.0)');
        grad.addColorStop(0.2, 'rgba(255, 230, 180, 0.7)');
        grad.addColorStop(0.5, 'rgba(255, 160, 90, 0.25)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    // Canvas 2D texture for Martian Blue Rayleigh/Mie Scattering Sunset Aura
    createBlueAuraTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(160, 220, 255, 0.95)');
        grad.addColorStop(0.25, 'rgba(70, 165, 255, 0.65)');
        grad.addColorStop(0.6, 'rgba(30, 100, 210, 0.25)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    }

    // High-Resolution (1024x1024) Procedural Normal & Roughness Maps for Fine Mars Micro-Gravel
    createProceduralTerrainTextures() {
        const size = 1024;
        const canvasN = document.createElement('canvas');
        canvasN.width = size;
        canvasN.height = size;
        const ctxN = canvasN.getContext('2d');

        const canvasR = document.createElement('canvas');
        canvasR.width = size;
        canvasR.height = size;
        const ctxR = canvasR.getContext('2d');

        const imgDataN = ctxN.createImageData(size, size);
        const dataN = imgDataN.data;
        const imgDataR = ctxR.createImageData(size, size);
        const dataR = imgDataR.data;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const index = (y * size + x) * 4;

                // Dune ripples
                let nx = Math.sin(x * 0.08) * Math.cos(y * 0.04) * 35;
                let ny = Math.cos(x * 0.04) * Math.sin(y * 0.08) * 35;

                // High-frequency micro-gravel speckle noise for crisp ground granularity
                const fineNoiseX = (Math.sin(x * 0.45 + y * 0.2) + (Math.random() - 0.5) * 0.6) * 45;
                const fineNoiseY = (Math.cos(y * 0.45 + x * 0.2) + (Math.random() - 0.5) * 0.6) * 45;

                nx += fineNoiseX;
                ny += fineNoiseY;
                
                dataN[index]     = Math.min(255, Math.max(0, 128 + nx));
                dataN[index + 1] = Math.min(255, Math.max(0, 128 + ny));
                dataN[index + 2] = 255;
                dataN[index + 3] = 255;

                const rough = 165 + Math.sin(x * 0.04 + y * 0.04) * 40 + (Math.random() - 0.5) * 30;
                dataR[index]     = Math.min(255, Math.max(0, rough));
                dataR[index + 1] = dataR[index];
                dataR[index + 2] = dataR[index];
                dataR[index + 3] = 255;
            }
        }

        ctxN.putImageData(imgDataN, 0, 0);
        ctxR.putImageData(imgDataR, 0, 0);

        const normalTex = new THREE.CanvasTexture(canvasN);
        normalTex.wrapS = THREE.RepeatWrapping;
        normalTex.wrapT = THREE.RepeatWrapping;
        normalTex.repeat.set(24, 24);

        const roughTex = new THREE.CanvasTexture(canvasR);
        roughTex.wrapS = THREE.RepeatWrapping;
        roughTex.wrapT = THREE.RepeatWrapping;
        roughTex.repeat.set(24, 24);

        return { normalMap: normalTex, roughnessMap: roughTex };
    }

    /**
     * Deterministic Infinite Mathematical Height Function getTerrainHeight(x, z)
     * Includes fine micro-gravel height variations for tactile ground granularity
     */
    getTerrainHeight(x, z) {
        let h = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 5.5;
        h += Math.sin(x * 0.038 + 1.4) * Math.sin(z * 0.038) * 2.2;
        h += Math.cos(x * 0.085) * Math.sin(z * 0.085) * 0.7;

        // Micro dune ripples & gravel physical roughness
        h += Math.sin(x * 0.25) * Math.cos(z * 0.25) * 0.14;
        h += Math.sin(x * 1.8) * Math.cos(z * 1.8) * 0.04;

        const craterGridSize = 240;
        const cx = Math.floor((x + craterGridSize / 2) / craterGridSize) * craterGridSize;
        const cz = Math.floor((z + craterGridSize / 2) / craterGridSize) * craterGridSize;
        const cDist = Math.hypot(x - cx, z - cz);

        if (cDist < 35) {
            const craterDepth = (1 - (cDist / 35));
            h -= craterDepth * craterDepth * 4.2;
            if (cDist > 25) {
                h += (1 - (cDist - 25) / 10) * 1.2;
            }
        }

        return h;
    }

    spatialHash(cellX, cellZ) {
        let n = cellX * 73856093 ^ cellZ * 19349663;
        n = (n << 13) ^ n;
        return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
    }

    initLightingAndFog() {
        const fogColor = new THREE.Color(0xd95738);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.006);
        this.scene.background = fogColor;

        this.ambientLight = new THREE.AmbientLight(0xffaa88, 0.75);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffddaa, 1.6);
        this.sunLight.position.set(100, 70, -100);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 350;
        const d = 150;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);
    }

    initSkyAndMoons() {
        const moonMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8, metalness: 0.2 });
        const phobos = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5, 1), moonMat);
        phobos.position.set(-120, 160, -200);
        this.scene.add(phobos);

        const deimos = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), moonMat);
        deimos.position.set(180, 190, -220);
        this.scene.add(deimos);
    }

    initAtmosphereDome() {
        const domeGeo = new THREE.SphereGeometry(360, 32, 16);
        const domeMat = new THREE.MeshBasicMaterial({ color: 0xd95738, side: THREE.BackSide, transparent: true, opacity: 0.85 });
        this.atmosphereDome = new THREE.Mesh(domeGeo, domeMat);
        this.scene.add(this.atmosphereDome);
    }

    initAstronomicalSun() {
        this.sunGroup = new THREE.Group();

        const diskGeo = new THREE.SphereGeometry(1.0, 32, 32);
        const diskMat = new THREE.MeshBasicMaterial({ color: 0xfffaee, fog: false });
        this.sunDisk = new THREE.Mesh(diskGeo, diskMat);
        this.sunGroup.add(this.sunDisk);

        const haloMat = new THREE.SpriteMaterial({
            map: this.sunGlowTexture,
            color: 0xfff0dd,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            fog: false
        });
        this.sunHalo = new THREE.Sprite(haloMat);
        this.sunHalo.scale.set(14, 14, 1);
        this.sunGroup.add(this.sunHalo);

        const blueMat = new THREE.SpriteMaterial({
            map: this.blueAuraTexture,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            fog: false
        });
        this.blueSunsetHalo = new THREE.Sprite(blueMat);
        this.blueSunsetHalo.scale.set(45, 45, 1);
        this.sunGroup.add(this.blueSunsetHalo);

        this.scene.add(this.sunGroup);
    }

    initInfiniteTerrain() {
        const geo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, this.segments, this.segments);
        geo.rotateX(-Math.PI / 2);

        const posAttr = geo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const terrainMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.15,
            flatShading: false,
            normalMap: this.proceduralTextures.normalMap,
            normalScale: new THREE.Vector2(1.4, 1.4), // Enhanced crispness for ground surface granularity
            roughnessMap: this.proceduralTextures.roughnessMap
        });

        this.terrainMesh = new THREE.Mesh(geo, terrainMat);
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);

        this.rebuildTerrainVertices(0, 0);
    }

    rebuildTerrainVertices(centerX, centerZ) {
        if (!this.terrainMesh) return;
        const geo = this.terrainMesh.geometry;
        const posAttr = geo.attributes.position;
        const colAttr = geo.attributes.color;
        const colors = colAttr.array;

        this.terrainMesh.position.set(centerX, 0, centerZ);

        const halfSize = this.terrainSize / 2;
        const step = this.terrainSize / this.segments;

        for (let i = 0; i < posAttr.count; i++) {
            const localX = (i % (this.segments + 1)) * step - halfSize;
            const localZ = Math.floor(i / (this.segments + 1)) * step - halfSize;

            const worldX = centerX + localX;
            const worldZ = centerZ + localZ;
            const worldY = this.getTerrainHeight(worldX, worldZ);

            posAttr.setY(i, worldY);

            const noiseFactor = (Math.sin(worldX * 0.08) + Math.cos(worldZ * 0.08)) * 0.05;
            const c = new THREE.Color();
            if (worldY > 3) {
                c.setHSL(0.04, 0.65, 0.32 + noiseFactor);
            } else if (worldY < -1) {
                c.setHSL(0.06, 0.80, 0.45 + noiseFactor);
            } else {
                c.setHSL(0.05, 0.72, 0.38 + noiseFactor);
            }

            const cIdx = i * 3;
            colors[cIdx]     = c.r;
            colors[cIdx + 1] = c.g;
            colors[cIdx + 2] = c.b;
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        geo.computeVertexNormals();
    }

    updateInfiniteTerrain(roverPos) {
        const snapStep = 8;
        const targetGridX = Math.floor(roverPos.x / snapStep) * snapStep;
        const targetGridZ = Math.floor(roverPos.z / snapStep) * snapStep;

        if (targetGridX !== this.gridCenterX || targetGridZ !== this.gridCenterZ) {
            this.gridCenterX = targetGridX;
            this.gridCenterZ = targetGridZ;
            this.rebuildTerrainVertices(this.gridCenterX, this.gridCenterZ);
        }

        if (this.atmosphereDome) {
            this.atmosphereDome.position.set(roverPos.x, 0, roverPos.z);
        }
    }

    initRockPool() {
        const rockGeo = new THREE.DodecahedronGeometry(1, 1);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b3a2b, roughness: 0.88, metalness: 0.15 });
        const crystalMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.8 });

        for (let i = 0; i < this.maxRocks; i++) {
            const isCrystal = (i % 14 === 0);
            const rock = new THREE.Mesh(rockGeo, isCrystal ? crystalMat : rockMat);
            rock.castShadow = true;
            rock.receiveShadow = true;
            rock.visible = false;
            this.scene.add(rock);
            this.rockPool.push(rock);
        }
    }

    updateInfiniteRocks(roverPos) {
        const cellSize = 18;
        const radiusCells = 8;
        const rCellX = Math.floor(roverPos.x / cellSize);
        const rCellZ = Math.floor(roverPos.z / cellSize);

        let rockIdx = 0;

        for (let cx = rCellX - radiusCells; cx <= rCellX + radiusCells; cx++) {
            for (let cz = rCellZ - radiusCells; cz <= rCellZ + radiusCells; cz++) {
                const val = this.spatialHash(cx, cz);
                if (val > 0.68) {
                    if (rockIdx >= this.maxRocks) break;

                    const rock = this.rockPool[rockIdx];
                    const offsetX = (val * 17) % cellSize;
                    const offsetZ = ((val * 31) % cellSize);
                    const worldX = cx * cellSize + offsetX;
                    const worldZ = cz * cellSize + offsetZ;
                    const worldY = this.getTerrainHeight(worldX, worldZ);

                    const scale = 0.6 + (val * 10) % 2.2;
                    rock.scale.set(scale, scale * (0.6 + (val * 5) % 0.6), scale);
                    rock.position.set(worldX, worldY + scale * 0.35, worldZ);
                    rock.rotation.set((val * 7) % Math.PI, (val * 13) % Math.PI, 0);
                    rock.visible = true;

                    rockIdx++;
                }
            }
        }

        for (let i = rockIdx; i < this.maxRocks; i++) {
            this.rockPool[i].visible = false;
        }
    }

    initDustParticles() {
        const particleCount = 800;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i]     = (Math.random() - 0.5) * 320;
            positions[i + 1] = Math.random() * 35;
            positions[i + 2] = (Math.random() - 0.5) * 320;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
            color: 0xff7744,
            size: 1.6,
            map: this.softParticleTexture,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.dustParticles = new THREE.Points(geo, pMat);
        this.scene.add(this.dustParticles);
    }

    // Layer 1: High-Granularity Volumetric Dust Plume System (250 particles)
    initWheelDustSystem() {
        const maxDust = 250;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(maxDust * 3);

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
            color: 0xe65c00,
            size: 3.2, // Billowing, textured dust clouds
            map: this.granularDustTexture,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.wheelDustSystem = new THREE.Points(geo, pMat);
        this.scene.add(this.wheelDustSystem);

        for (let i = 0; i < maxDust; i++) {
            this.wheelDustPositions.push({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
        }
    }

    // Layer 2: Sharp Micro-Sand & Gravel Kickback Spray System (150 particles)
    initSandSparksSystem() {
        const maxSparks = 150;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(maxSparks * 3);

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
            color: 0xffb870,
            size: 0.8, // Sharp, granular sand specks
            map: this.sandGrainTexture,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.sandSparksSystem = new THREE.Points(geo, pMat);
        this.scene.add(this.sandSparksSystem);

        for (let i = 0; i < maxSparks; i++) {
            this.sandSparksPositions.push({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
        }
    }

    triggerWheelDust(roverPos, speed, isDrifting = false) {
        if (Math.abs(speed) < 0.8) return;

        const speedRatio = Math.min(1.5, Math.abs(speed) / 16.0);

        // 1. Emit Granular Dust Smoke Plumes
        const freeDustIdx = this.wheelDustPositions.findIndex(p => p.life <= 0);
        if (freeDustIdx !== -1) {
            const spread = isDrifting ? 3.2 : 1.8;
            this.wheelDustPositions[freeDustIdx] = {
                x: roverPos.x + (Math.random() - 0.5) * spread,
                y: roverPos.y + 0.15,
                z: roverPos.z + (Math.random() - 0.5) * spread,
                vx: (Math.random() - 0.5) * (isDrifting ? 3.0 : 1.4) * speedRatio,
                vy: 0.9 + Math.random() * (isDrifting ? 2.2 : 1.2) * speedRatio,
                vz: (Math.random() - 0.5) * (isDrifting ? 3.0 : 1.4) * speedRatio,
                life: isDrifting ? 1.6 : 1.1
            };
        }

        // 2. Emit Sharp Sand/Gravel Kickback Specks (Granular Tire Spray)
        const freeSparkIdx = this.sandSparksPositions.findIndex(p => p.life <= 0);
        if (freeSparkIdx !== -1) {
            this.sandSparksPositions[freeSparkIdx] = {
                x: roverPos.x + (Math.random() - 0.5) * 1.4,
                y: roverPos.y + 0.1,
                z: roverPos.z + (Math.random() - 0.5) * 1.4,
                vx: (Math.random() - 0.5) * 4.5 * speedRatio,
                vy: 1.5 + Math.random() * 3.5 * speedRatio, // Kick upward & back
                vz: (Math.random() - 0.5) * 4.5 * speedRatio,
                life: 0.4 + Math.random() * 0.4
            };
        }
    }

    updateAstronomicalDayNightCycle(deltaTime, roverPos) {
        this.dayTime = (this.dayTime + deltaTime * (1 / 720)) % 1.0;

        const lat = 18.38 * (Math.PI / 180);
        const decl = 25.19 * (Math.PI / 180) * Math.sin(this.dayTime * Math.PI * 2);
        const hourAngle = (this.dayTime - 0.5) * Math.PI * 2;

        const sinElevation = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
        const elevation = Math.asin(Math.min(1, Math.max(-1, sinElevation)));

        const cosAzimuth = (Math.sin(decl) - Math.sin(lat) * sinElevation) / (Math.cos(lat) * Math.cos(elevation) + 0.0001);
        const azimuth = hourAngle >= 0 ? Math.acos(Math.min(1, Math.max(-1, cosAzimuth))) : -Math.acos(Math.min(1, Math.max(-1, cosAzimuth)));

        const skyRadius = 300;
        const refPos = roverPos || new THREE.Vector3(0, 0, 0);

        const sunX = refPos.x + skyRadius * Math.cos(elevation) * Math.sin(azimuth);
        const sunY = refPos.y + skyRadius * Math.sin(elevation);
        const sunZ = refPos.z - skyRadius * Math.cos(elevation) * Math.cos(azimuth);

        if (this.sunGroup) {
            this.sunGroup.position.set(sunX, sunY, sunZ);
            this.sunGroup.lookAt(refPos);
        }

        if (this.sunLight) {
            this.sunLight.position.set(sunX, Math.max(refPos.y + 10, sunY), sunZ);
        }

        const elevDeg = elevation * (180 / Math.PI);

        if (elevDeg < -6) {
            this.scene.fog.color.setHSL(0.62, 0.5, 0.04);
            this.scene.background.setHSL(0.62, 0.5, 0.04);
            if (this.sunLight) {
                this.sunLight.intensity = 0.05;
                this.sunLight.color.setHSL(0.6, 0.4, 0.2);
            }
            if (this.ambientLight) this.ambientLight.intensity = 0.15;
            if (this.blueSunsetHalo) this.blueSunsetHalo.material.opacity = 0;
            if (this.sunDisk) this.sunDisk.visible = false;
            if (this.sunHalo) this.sunHalo.visible = false;

        } else if (elevDeg >= -6 && elevDeg <= 22) {
            const t = (elevDeg + 6) / 28.0;
            const fogHue = 0.02 + t * 0.03;
            const fogSat = 0.75;
            const fogLight = 0.12 + t * 0.32;
            this.scene.fog.color.setHSL(fogHue, fogSat, fogLight);
            this.scene.background.setHSL(fogHue, fogSat, fogLight);

            if (this.sunLight) {
                this.sunLight.intensity = 0.4 + t * 1.2;
                this.sunLight.color.setHSL(0.06, 0.9, 0.5 + t * 0.2);
            }
            if (this.ambientLight) this.ambientLight.intensity = 0.3 + t * 0.45;

            const blueIntensity = Math.sin(Math.min(1, (elevDeg + 6) / 24) * Math.PI);
            if (this.blueSunsetHalo) {
                this.blueSunsetHalo.material.opacity = blueIntensity * 0.95;
            }

            if (this.sunDisk) {
                this.sunDisk.visible = true;
                this.sunDisk.material.color.setHSL(0.58, 0.4, 0.9);
            }
            if (this.sunHalo) {
                this.sunHalo.visible = true;
                this.sunHalo.material.opacity = 0.85;
            }

        } else {
            this.scene.fog.color.setHSL(0.05, 0.7, 0.42);
            this.scene.background.setHSL(0.05, 0.7, 0.42);

            if (this.sunLight) {
                this.sunLight.intensity = 1.6;
                this.sunLight.color.setHSL(0.08, 0.8, 0.7);
            }
            if (this.ambientLight) this.ambientLight.intensity = 0.75;

            if (this.blueSunsetHalo) this.blueSunsetHalo.material.opacity = 0.15;
            if (this.sunDisk) {
                this.sunDisk.visible = true;
                this.sunDisk.material.color.setHex(0xfffaee);
            }
            if (this.sunHalo) {
                this.sunHalo.visible = true;
                this.sunHalo.material.opacity = 0.85;
            }
        }
    }

    update(deltaTime, roverPos) {
        this.updateAstronomicalDayNightCycle(deltaTime, roverPos);

        if (roverPos) {
            this.updateInfiniteTerrain(roverPos);
            this.updateInfiniteRocks(roverPos);
        }

        // 1. Update Granular Dust Smoke Plumes Animation
        if (this.wheelDustSystem) {
            const posAttr = this.wheelDustSystem.geometry.attributes.position;
            this.wheelDustPositions.forEach((p, idx) => {
                if (p.life > 0) {
                    p.x += p.vx * deltaTime;
                    p.y += p.vy * deltaTime;
                    p.z += p.vz * deltaTime;
                    p.life -= deltaTime * 1.1;
                    posAttr.setXYZ(idx, p.x, p.y, p.z);
                } else {
                    posAttr.setXYZ(idx, 0, -100, 0);
                }
            });
            posAttr.needsUpdate = true;
        }

        // 2. Update Sharp Sand Kickback Specks Animation
        if (this.sandSparksSystem) {
            const posAttr = this.sandSparksSystem.geometry.attributes.position;
            this.sandSparksPositions.forEach((p, idx) => {
                if (p.life > 0) {
                    p.x += p.vx * deltaTime;
                    p.y += p.vy * deltaTime - 3.5 * deltaTime; // gravity pull
                    p.z += p.vz * deltaTime;
                    p.life -= deltaTime * 2.2;
                    posAttr.setXYZ(idx, p.x, p.y, p.z);
                } else {
                    posAttr.setXYZ(idx, 0, -100, 0);
                }
            });
            posAttr.needsUpdate = true;
        }

        // Drift ambient dust particles relative to Rover
        if (this.dustParticles && roverPos) {
            const posAttr = this.dustParticles.geometry.attributes.position;
            const windSpeed = 8;

            for (let i = 0; i < posAttr.count; i++) {
                let x = posAttr.getX(i) + windSpeed * deltaTime;
                let y = posAttr.getY(i) - 0.5 * deltaTime;
                let z = posAttr.getZ(i) + (windSpeed * 0.3) * deltaTime;

                if (Math.abs(x - roverPos.x) > 160) x = roverPos.x - 160;
                if (y < 0) y = 35;
                if (Math.abs(z - roverPos.z) > 160) z = roverPos.z - 160;

                posAttr.setXYZ(i, x, y, z);
            }
            posAttr.needsUpdate = true;
        }
    }
}
