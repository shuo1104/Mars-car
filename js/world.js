/**
 * Mars World Generator: Infinite Procedural Terrain, Dynamic Sky, Volumetric Weather & Particle Systems
 * Implements Chunkless Grid-Shifting Infinite Terrain, Deterministic Object Pooling, and 2D Perlin-Noise Mars Dunes
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
        this.samples = [];

        // Visual enhancement systems
        this.wheelDustSystem = null;
        this.wheelDustPositions = [];
        this.sparkParticles = null;
        this.atmosphereDome = null;
        this.dayTime = 0.25; // 0 to 1 cycle
        this.sunLight = null;
        this.ambientLight = null;

        // Rock pooling for infinite procedural scattering
        this.rockPool = [];
        this.maxRocks = 180;

        // Particle textures & procedural normal maps
        this.softParticleTexture = this.createSoftParticleTexture();
        this.proceduralTextures = this.createProceduralTerrainTextures();

        this.initLightingAndFog();
        this.initSkyAndMoons();
        this.initAtmosphereDome();
        this.initInfiniteTerrain();
        this.initRockPool();
        this.initDustParticles();
        this.initWheelDustSystem();
        this.initSparkParticleSystem();
        this.spawnScientificSamples();
    }

    // Canvas 2D soft particle texture for volumetric smoke/dust
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

    // Canvas 2D procedural Normal Map and Roughness Map for Mars Soil
    createProceduralTerrainTextures() {
        const size = 512;
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
                const nx = Math.sin(x * 0.15) * Math.cos(y * 0.08) * 40;
                const ny = Math.cos(x * 0.08) * Math.sin(y * 0.15) * 40;
                
                dataN[index]     = Math.min(255, Math.max(0, 128 + nx));
                dataN[index + 1] = Math.min(255, Math.max(0, 128 + ny));
                dataN[index + 2] = 255;
                dataN[index + 3] = 255;

                const rough = 170 + Math.sin(x * 0.06 + y * 0.06) * 55;
                dataR[index]     = rough;
                dataR[index + 1] = rough;
                dataR[index + 2] = rough;
                dataR[index + 3] = 255;
            }
        }

        ctxN.putImageData(imgDataN, 0, 0);
        ctxR.putImageData(imgDataR, 0, 0);

        const normalTex = new THREE.CanvasTexture(canvasN);
        normalTex.wrapS = THREE.RepeatWrapping;
        normalTex.wrapT = THREE.RepeatWrapping;
        normalTex.repeat.set(18, 18);

        const roughTex = new THREE.CanvasTexture(canvasR);
        roughTex.wrapS = THREE.RepeatWrapping;
        roughTex.wrapT = THREE.RepeatWrapping;
        roughTex.repeat.set(18, 18);

        return { normalMap: normalTex, roughnessMap: roughTex };
    }

    /**
     * Deterministic Infinite Mathematical Height Function getTerrainHeight(x, z)
     * Valid for any (x, z) from -infinity to +infinity!
     */
    getTerrainHeight(x, z) {
        // Multi-octave rolling dunes
        let h = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 5.5;
        h += Math.sin(x * 0.038 + 1.4) * Math.sin(z * 0.038) * 2.2;
        h += Math.cos(x * 0.085) * Math.sin(z * 0.085) * 0.7;

        // Micro ripples
        h += Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.12;

        // Periodic large crater dishes spaced every ~250m
        const craterGridSize = 240;
        const cx = Math.floor((x + craterGridSize / 2) / craterGridSize) * craterGridSize;
        const cz = Math.floor((z + craterGridSize / 2) / craterGridSize) * craterGridSize;
        const cDist = Math.hypot(x - cx, z - cz);

        if (cDist < 35) {
            const craterDepth = (1 - (cDist / 35));
            h -= craterDepth * craterDepth * 4.2; // Dish cavity
            if (cDist > 25) {
                h += (1 - (cDist - 25) / 10) * 1.2; // Crater rim lip
            }
        }

        return h;
    }

    // Pseudo-random deterministic spatial hash for infinite rock placement
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

    initInfiniteTerrain() {
        const geo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, this.segments, this.segments);
        geo.rotateX(-Math.PI / 2);

        const posAttr = geo.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const terrainMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.88,
            metalness: 0.12,
            flatShading: false,
            normalMap: this.proceduralTextures.normalMap,
            normalScale: new THREE.Vector2(0.65, 0.65),
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

            // Soil color gradient based on elevation & noise
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

        // Keep Atmosphere Dome centered on Rover
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
        const radiusCells = 8; // ~144m view radius
        const rCellX = Math.floor(roverPos.x / cellSize);
        const rCellZ = Math.floor(roverPos.z / cellSize);

        let rockIdx = 0;

        for (let cx = rCellX - radiusCells; cx <= rCellX + radiusCells; cx++) {
            for (let cz = rCellZ - radiusCells; cz <= rCellZ + radiusCells; cz++) {
                const val = this.spatialHash(cx, cz);
                if (val > 0.68) { // 32% chance of rock in this cell
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

        // Hide remaining unused rocks in pool
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

    initWheelDustSystem() {
        const maxDust = 120;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(maxDust * 3);

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
            color: 0xe65c00,
            size: 2.4,
            map: this.softParticleTexture,
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.wheelDustSystem = new THREE.Points(geo, pMat);
        this.scene.add(this.wheelDustSystem);

        for (let i = 0; i < maxDust; i++) {
            this.wheelDustPositions.push({ x: 0, y: -100, z: 0, life: 0 });
        }
    }

    initSparkParticleSystem() {
        const sparkCount = 60;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(sparkCount * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
            color: 0x00e5ff,
            size: 0.8,
            map: this.softParticleTexture,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.sparkParticles = new THREE.Points(geo, pMat);
        this.sparkParticles.visible = false;
        this.scene.add(this.sparkParticles);
    }

    triggerWheelDust(roverPos, speed, isDrifting = false) {
        if (Math.abs(speed) < 0.8) return;

        const freeIndex = this.wheelDustPositions.findIndex(p => p.life <= 0);
        if (freeIndex !== -1) {
            const spread = isDrifting ? 2.8 : 1.6;
            this.wheelDustPositions[freeIndex] = {
                x: roverPos.x + (Math.random() - 0.5) * spread,
                y: roverPos.y + 0.2,
                z: roverPos.z + (Math.random() - 0.5) * spread,
                vx: (Math.random() - 0.5) * (isDrifting ? 2.5 : 1.2),
                vy: 0.8 + Math.random() * (isDrifting ? 1.8 : 1.0),
                vz: (Math.random() - 0.5) * (isDrifting ? 2.5 : 1.2),
                life: isDrifting ? 1.4 : 1.0
            };
        }
    }

    triggerScanSparks(targetPos) {
        if (!this.sparkParticles) return;
        this.sparkParticles.visible = true;
        const posAttr = this.sparkParticles.geometry.attributes.position;

        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setXYZ(
                i,
                targetPos.x + (Math.random() - 0.5) * 2.2,
                targetPos.y + Math.random() * 1.6,
                targetPos.z + (Math.random() - 0.5) * 2.2
            );
        }
        posAttr.needsUpdate = true;
    }

    hideScanSparks() {
        if (this.sparkParticles) this.sparkParticles.visible = false;
    }

    spawnScientificSamples() {
        const sampleDefinitions = [
            { id: 1, name: "橄榄石深层岩样", type: "火成岩矿物", color: 0x30d158, desc: "形成于深层地幔的富镁橄榄石，保留了火星早期热演化的关键化石信息。", pos: { x: 35, z: -40 } },
            { id: 2, name: "耶泽罗三角洲绿泥石", type: "古湖泊沉积", color: 0x00e5ff, desc: "形成于 37 亿年前古河流结晶的水合硅酸盐黏土，极具古生命沉积印记。", pos: { x: -65, z: 50 } },
            { id: 3, name: "深层水冰地下核心", type: "冰晶遗迹", color: 0x60a5fa, desc: "冻结于地表以下 1.5 米处的纯净高浓度水冰晶体，含微量溶解气泡。", pos: { x: 70, z: 85 } },
            { id: 4, name: "强磁赤铁矿异常", type: "强磁矿物", color: 0xff3b30, desc: "呈高度各向异性磁化的赤铁矿结晶，记录了古火星磁场的倒转事件。", pos: { x: -90, z: -80 } },
            { id: 5, name: "赤铁矿蓝莓结核", type: "球状沉积", color: 0xa855f7, desc: "著名的“蓝莓”球粒状赤铁矿，由地下水渗透沉淀缓慢生长而成。", pos: { x: 110, z: -60 } },
            { id: 6, name: "陨石撞击熔融玻璃", type: "高压熔岩", color: 0xf59e0b, desc: "极高温度陨石撞击产生的淬火二氧化硅玻璃，封装有撞击瞬间的大气微粒。", pos: { x: -120, z: 30 } },
            { id: 7, name: "古叠层石生物基质", type: "有机遗迹", color: 0xfacc15, desc: "具有层状结构的碳酸盐微沉淀物，与地球最古老蓝藻叠层石形态高度吻合！", pos: { x: 45, z: 120 } },
            { id: 8, name: "奇异火星晶体巨石", type: "未知异象", color: 0xec4899, desc: "发射未知微弱电磁脉冲的规则棱柱晶体，成分无法用传统矿物学完全解释。", pos: { x: -30, z: -130 } }
        ];

        sampleDefinitions.forEach(def => {
            const y = this.getTerrainHeight(def.pos.x, def.pos.z);
            
            const sGeo = new THREE.OctahedronGeometry(0.9, 1);
            const sMat = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 1.0,
                roughness: 0.1,
                metalness: 0.95
            });

            const sampleMesh = new THREE.Mesh(sGeo, sMat);
            sampleMesh.position.set(def.pos.x, y + 1.3, def.pos.z);
            this.scene.add(sampleMesh);

            const beaconGeo = new THREE.CylinderGeometry(0.12, 0.12, 18, 8);
            beaconGeo.translate(0, 9, 0);
            const beaconMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.45 });
            const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
            beaconMesh.position.set(def.pos.x, y, def.pos.z);
            this.scene.add(beaconMesh);

            const ringGeo = new THREE.RingGeometry(1.2, 1.5, 32);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: def.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
            const hologramRing = new THREE.Mesh(ringGeo, ringMat);
            hologramRing.position.set(def.pos.x, y + 0.05, def.pos.z);
            this.scene.add(hologramRing);

            this.samples.push({
                ...def,
                y: y,
                mesh: sampleMesh,
                beacon: beaconMesh,
                hologramRing: hologramRing,
                collected: false
            });
        });
    }

    setSandstorm(active) {
        this.sandstormActive = active;
        const fogDensity = active ? 0.035 : 0.006;
        this.scene.fog.density = fogDensity;
        window.roverAudio.setSandstormWind(active);
    }

    updateDayNightCycle(deltaTime) {
        // 12-minute full Martian Day/Night Cycle
        this.dayTime = (this.dayTime + deltaTime * (1 / 720)) % 1.0;
        const sunAngle = this.dayTime * Math.PI * 2;

        const sunX = Math.cos(sunAngle) * 120;
        const sunY = Math.sin(sunAngle) * 90;
        const sunZ = Math.sin(sunAngle * 0.5) * 100;

        if (this.sunLight) {
            this.sunLight.position.set(sunX, Math.max(10, sunY), sunZ);
            
            if (sunY < 20) {
                this.scene.fog.color.setHSL(0.02, 0.75, 0.12);
                this.scene.background.setHSL(0.02, 0.75, 0.12);
                this.sunLight.color.setHSL(0.05, 0.9, 0.4);
                this.ambientLight.intensity = 0.3;
            } else {
                this.scene.fog.color.setHSL(0.05, 0.7, 0.42);
                this.scene.background.setHSL(0.05, 0.7, 0.42);
                this.sunLight.color.setHSL(0.08, 0.8, 0.65);
                this.ambientLight.intensity = 0.75;
            }
        }
    }

    update(deltaTime, roverPos) {
        this.updateDayNightCycle(deltaTime);

        if (roverPos) {
            this.updateInfiniteTerrain(roverPos);
            this.updateInfiniteRocks(roverPos);
        }

        // Animate sample markers & hologram ring pulse
        this.samples.forEach(s => {
            if (!s.collected) {
                s.mesh.rotation.y += deltaTime * 1.5;
                s.mesh.position.y = s.y + 1.3 + Math.sin(Date.now() * 0.003 + s.id) * 0.25;
                if (s.hologramRing) {
                    s.hologramRing.rotation.z += deltaTime * 0.8;
                    const scale = 1.0 + Math.sin(Date.now() * 0.004 + s.id) * 0.15;
                    s.hologramRing.scale.set(scale, scale, scale);
                }
            }
        });

        // Update wheel dust particle animation
        if (this.wheelDustSystem) {
            const posAttr = this.wheelDustSystem.geometry.attributes.position;
            this.wheelDustPositions.forEach((p, idx) => {
                if (p.life > 0) {
                    p.x += p.vx * deltaTime;
                    p.y += p.vy * deltaTime;
                    p.z += p.vz * deltaTime;
                    p.life -= deltaTime * 1.2;
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
            const windSpeed = this.sandstormActive ? 35 : 8;

            for (let i = 0; i < posAttr.count; i++) {
                let x = posAttr.getX(i) + windSpeed * deltaTime;
                let y = posAttr.getY(i) - (this.sandstormActive ? 2.8 : 0.5) * deltaTime;
                let z = posAttr.getZ(i) + (windSpeed * 0.3) * deltaTime;

                // Keep particles inside bounding box around Rover
                if (Math.abs(x - roverPos.x) > 160) x = roverPos.x - 160;
                if (y < 0) y = 35;
                if (Math.abs(z - roverPos.z) > 160) z = roverPos.z - 160;

                posAttr.setXYZ(i, x, y, z);
            }
            posAttr.needsUpdate = true;
        }
    }
}
