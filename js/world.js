/**
 * Mars World Generator: Procedural Terrain, Sky, Lighting, Weather, Wheel Tracks, and Sample Waypoints
 */
class MarsWorld {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.terrainSize = 400; // 400m x 400m map size
        this.segments = 140;
        this.dustParticles = null;
        this.sandstormActive = false;
        this.samples = [];

        // Visual enhancement systems
        this.wheelDustSystem = null;
        this.wheelDustPositions = [];
        this.wheelTracksMesh = null;
        this.trackPoints = [];
        this.dayTime = 0.25; // 0 to 1 cycle
        this.sunLight = null;
        this.ambientLight = null;
        this.sparkParticles = null;

        this.initLightingAndFog();
        this.initSkyAndMoons();
        this.generateTerrain();
        this.scatterBouldersAndCraters();
        this.initDustParticles();
        this.initWheelDustSystem();
        this.initSparkParticleSystem();
        this.spawnScientificSamples();
    }

    // Procedural height function for Mars craters and rolling dunes
    getTerrainHeight(x, z) {
        const d = Math.sqrt(x * x + z * z);
        let h = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 3.5;
        h += Math.sin(x * 0.06 + 1.2) * Math.sin(z * 0.06) * 1.2;
        h += Math.cos(x * 0.12) * Math.sin(z * 0.12) * 0.5;

        // Add a central crater near spawn (shallow flat dish)
        if (d < 40) {
            h -= (1 - (d / 40)) * 2.5;
        }

        // Add distant mountainous boundary ring
        if (d > 140) {
            const edge = (d - 140) * 0.15;
            h += edge * edge;
        }

        return h;
    }

    initLightingAndFog() {
        // Mars reddish fog & atmosphere
        const fogColor = new THREE.Color(0xd95738);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.008);
        this.scene.background = fogColor;

        // Ambient Sun & Sky Light
        this.ambientLight = new THREE.AmbientLight(0xffaa88, 0.65);
        this.scene.add(this.ambientLight);

        // Directional Sun Light
        this.sunLight = new THREE.DirectionalLight(0xffddaa, 1.4);
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
        this.scene.add(this.sunLight);
    }

    initSkyAndMoons() {
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
        
        const phobos = new THREE.Mesh(new THREE.DodecahedronGeometry(2, 1), moonMat);
        phobos.position.set(-120, 160, -200);
        this.scene.add(phobos);

        const deimos = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), moonMat);
        deimos.position.set(180, 190, -220);
        this.scene.add(deimos);
    }

    generateTerrain() {
        const geo = new THREE.PlaneGeometry(this.terrainSize, this.terrainSize, this.segments, this.segments);
        geo.rotateX(-Math.PI / 2);

        const posAttr = geo.attributes.position;
        const colors = [];

        // Generate procedural noise texture variation
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            const y = this.getTerrainHeight(x, z);
            posAttr.setY(i, y);

            // Add fine surface micro-roughness
            const microNoise = Math.sin(x * 1.5) * Math.cos(z * 1.5) * 0.08;
            posAttr.setY(i, y + microNoise);

            // Red-orange Mars soil gradient based on elevation & slope
            const c = new THREE.Color();
            const noiseFactor = (Math.sin(x * 0.1) + Math.cos(z * 0.1)) * 0.05;

            if (y > 3) {
                c.setHSL(0.04, 0.65, 0.32 + noiseFactor); // High dark rocky ground
            } else if (y < -1) {
                c.setHSL(0.06, 0.80, 0.45 + noiseFactor); // Basin reddish dust
            } else {
                c.setHSL(0.05, 0.72, 0.38 + noiseFactor); // Standard rust soil
            }
            colors.push(c.r, c.g, c.b);
        }

        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const terrainMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.88,
            metalness: 0.12,
            flatShading: false
        });

        this.terrainMesh = new THREE.Mesh(geo, terrainMat);
        this.terrainMesh.receiveShadow = true;
        this.scene.add(this.terrainMesh);
    }

    scatterBouldersAndCraters() {
        const rockGeo = new THREE.DodecahedronGeometry(1, 1);
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x8b3a2b,
            roughness: 0.9,
            metalness: 0.1
        });

        const numBoulders = 200;
        for (let i = 0; i < numBoulders; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 14 + Math.random() * 160;
            const x = Math.sin(angle) * dist;
            const z = Math.cos(angle) * dist;
            const y = this.getTerrainHeight(x, z);

            const rock = new THREE.Mesh(rockGeo, rockMat);
            const scale = 0.5 + Math.random() * 2.5;
            rock.scale.set(scale, scale * (0.6 + Math.random() * 0.6), scale);
            rock.position.set(x, y + scale * 0.4, z);
            rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    initDustParticles() {
        const particleCount = 700;
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
            size: 0.9,
            transparent: true,
            opacity: 0.45
        });

        this.dustParticles = new THREE.Points(geo, pMat);
        this.scene.add(this.dustParticles);
    }

    initWheelDustSystem() {
        const maxDust = 80;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(maxDust * 3);
        const opacities = new Float32Array(maxDust);

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

        const pMat = new THREE.PointsMaterial({
            color: 0xe65c00,
            size: 1.4,
            transparent: true,
            opacity: 0.6
        });

        this.wheelDustSystem = new THREE.Points(geo, pMat);
        this.scene.add(this.wheelDustSystem);

        for (let i = 0; i < maxDust; i++) {
            this.wheelDustPositions.push({ x: 0, y: -100, z: 0, life: 0 });
        }
    }

    initSparkParticleSystem() {
        const sparkCount = 40;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(sparkCount * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
            color: 0x00e5ff,
            size: 0.5,
            transparent: true,
            opacity: 0.9
        });

        this.sparkParticles = new THREE.Points(geo, pMat);
        this.sparkParticles.visible = false;
        this.scene.add(this.sparkParticles);
    }

    triggerWheelDust(roverPos, speed) {
        if (Math.abs(speed) < 1.0) return;

        // Emit dust particles behind rear wheels
        const freeIndex = this.wheelDustPositions.findIndex(p => p.life <= 0);
        if (freeIndex !== -1) {
            this.wheelDustPositions[freeIndex] = {
                x: roverPos.x + (Math.random() - 0.5) * 1.5,
                y: roverPos.y + 0.2,
                z: roverPos.z + (Math.random() - 0.5) * 1.5,
                vx: (Math.random() - 0.5) * 0.8,
                vy: 0.6 + Math.random() * 0.8,
                vz: (Math.random() - 0.5) * 0.8,
                life: 1.0
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
                targetPos.x + (Math.random() - 0.5) * 1.8,
                targetPos.y + Math.random() * 1.2,
                targetPos.z + (Math.random() - 0.5) * 1.8
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
            { id: 5, name: "赤铁矿蓝莓结核", type: "球状沉积", color: 0xa855f7, desc: "著名的“蓝莓”球粒状赤铁矿，由地下地下水渗透沉淀缓慢生长而成。", pos: { x: 110, z: -60 } },
            { id: 6, name: "陨石撞击熔融玻璃", type: "高压熔岩", color: 0xf59e0b, desc: "极高温度陨石撞击产生的淬火二氧化硅玻璃，封装有撞击瞬间的大气微粒。", pos: { x: -120, z: 30 } },
            { id: 7, name: "古叠层石生物基质", type: "有机遗迹", color: 0xfacc15, desc: "具有层状结构的碳酸盐微沉淀物，与地球最古老蓝藻叠层石形态高度吻合！", pos: { x: 45, z: 120 } },
            { id: 8, name: "奇异火星晶体巨石", type: "未知异象", color: 0xec4899, desc: "发射未知微弱电磁脉冲的规则棱柱晶体，成分无法用传统矿物学完全解释。", pos: { x: -30, z: -130 } }
        ];

        sampleDefinitions.forEach(def => {
            const y = this.getTerrainHeight(def.pos.x, def.pos.z);
            
            const sGeo = new THREE.OctahedronGeometry(0.8, 0);
            const sMat = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 0.85,
                roughness: 0.15,
                metalness: 0.95
            });

            const sampleMesh = new THREE.Mesh(sGeo, sMat);
            sampleMesh.position.set(def.pos.x, y + 1.2, def.pos.z);
            this.scene.add(sampleMesh);

            // Vertical Beacon Light Pillar with dynamic glow
            const beaconGeo = new THREE.CylinderGeometry(0.12, 0.12, 18, 8);
            beaconGeo.translate(0, 9, 0);
            const beaconMat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.4
            });
            const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
            beaconMesh.position.set(def.pos.x, y, def.pos.z);
            this.scene.add(beaconMesh);

            this.samples.push({
                ...def,
                y: y,
                mesh: sampleMesh,
                beacon: beaconMesh,
                collected: false
            });
        });
    }

    setSandstorm(active) {
        this.sandstormActive = active;
        const fogDensity = active ? 0.035 : 0.008;
        this.scene.fog.density = fogDensity;
        window.roverAudio.setSandstormWind(active);
    }

    updateDayNightCycle(deltaTime) {
        // Slow Day-Night cycle progression
        this.dayTime = (this.dayTime + deltaTime * 0.005) % 1.0;
        const sunAngle = this.dayTime * Math.PI * 2;

        const sunX = Math.cos(sunAngle) * 120;
        const sunY = Math.sin(sunAngle) * 90;
        const sunZ = Math.sin(sunAngle * 0.5) * 100;

        if (this.sunLight) {
            this.sunLight.position.set(sunX, Math.max(10, sunY), sunZ);
            
            // Adjust light tint from bright day to dusk/night
            if (sunY < 20) {
                // Dusk / Night atmosphere
                this.scene.fog.color.setHSL(0.02, 0.75, 0.12);
                this.scene.background.setHSL(0.02, 0.75, 0.12);
                this.sunLight.color.setHSL(0.05, 0.9, 0.4);
                this.ambientLight.intensity = 0.25;
            } else {
                // Daytime
                this.scene.fog.color.setHSL(0.05, 0.7, 0.42);
                this.scene.background.setHSL(0.05, 0.7, 0.42);
                this.sunLight.color.setHSL(0.08, 0.8, 0.65);
                this.ambientLight.intensity = 0.65;
            }
        }
    }

    update(deltaTime) {
        this.updateDayNightCycle(deltaTime);

        // Animate floating and spinning sample markers
        this.samples.forEach(s => {
            if (!s.collected) {
                s.mesh.rotation.y += deltaTime * 1.5;
                s.mesh.position.y = s.y + 1.2 + Math.sin(Date.now() * 0.003 + s.id) * 0.25;
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

        // Drift ambient dust particles with Mars wind
        if (this.dustParticles) {
            const posAttr = this.dustParticles.geometry.attributes.position;
            const windSpeed = this.sandstormActive ? 32 : 7;

            for (let i = 0; i < posAttr.count; i++) {
                let x = posAttr.getX(i) + windSpeed * deltaTime;
                let y = posAttr.getY(i) - (this.sandstormActive ? 2.5 : 0.4) * deltaTime;
                let z = posAttr.getZ(i) + (windSpeed * 0.3) * deltaTime;

                if (x > 160) x = -160;
                if (y < 0) y = 35;
                if (z > 160) z = -160;

                posAttr.setXYZ(i, x, y, z);
            }
            posAttr.needsUpdate = true;
        }
    }
}
