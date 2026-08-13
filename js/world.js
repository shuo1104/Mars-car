/**
 * Mars World Generator: Procedural Terrain, Sky, Lighting, Weather, and Sample Waypoints
 */
class MarsWorld {
    constructor(scene) {
        this.scene = scene;
        this.terrainMesh = null;
        this.terrainSize = 400; // 400m x 400m map size
        this.segments = 120;
        this.dustParticles = null;
        this.sandstormActive = false;
        this.samples = [];

        this.initLightingAndFog();
        this.initSkyAndMoons();
        this.generateTerrain();
        this.scatterBouldersAndCraters();
        this.initDustParticles();
        this.spawnScientificSamples();
    }

    // Procedural height function for Mars craters and rolling dunes
    getTerrainHeight(x, z) {
        // Multi-frequency trigonometric noise simulating craters & ridges
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
        const ambientLight = new THREE.AmbientLight(0xffaa88, 0.65);
        this.scene.add(ambientLight);

        // Directional Sun Light (Low angle sun casting long dramatic shadows)
        const sunLight = new THREE.DirectionalLight(0xffddaa, 1.3);
        sunLight.position.set(100, 70, -100);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 350;
        const d = 150;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        this.scene.add(sunLight);
    }

    initSkyAndMoons() {
        // Celestial Moons: Phobos & Deimos
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

        // Apply procedural height map & color variation
        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);
            const y = this.getTerrainHeight(x, z);
            posAttr.setY(i, y);

            // Red-orange Mars soil gradient based on elevation
            const c = new THREE.Color();
            if (y > 3) {
                c.setHSL(0.04, 0.65, 0.35 + (y * 0.02)); // Higher dark rocks
            } else if (y < -1) {
                c.setHSL(0.06, 0.75, 0.42); // Dust crater basin
            } else {
                c.setHSL(0.05, 0.70, 0.38); // Standard rust dust
            }
            colors.push(c.r, c.g, c.b);
        }

        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const terrainMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.15
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

        const numBoulders = 180;
        for (let i = 0; i < numBoulders; i++) {
            // Random scatter, keep clear of immediate starting spawn (radius 12m)
            const angle = Math.random() * Math.PI * 2;
            const dist = 14 + Math.random() * 160;
            const x = Math.sin(angle) * dist;
            const z = Math.cos(angle) * dist;
            const y = this.getTerrainHeight(x, z);

            const rock = new THREE.Mesh(rockGeo, rockMat);
            const scale = 0.5 + Math.random() * 2.2;
            rock.scale.set(scale, scale * (0.6 + Math.random() * 0.6), scale);
            rock.position.set(x, y + scale * 0.4, z);
            rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    initDustParticles() {
        const particleCount = 600;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i]     = (Math.random() - 0.5) * 300;
            positions[i + 1] = Math.random() * 30;
            positions[i + 2] = (Math.random() - 0.5) * 300;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
            color: 0xff7744,
            size: 0.8,
            transparent: true,
            opacity: 0.45
        });

        this.dustParticles = new THREE.Points(geo, pMat);
        this.scene.add(this.dustParticles);
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
            
            // Glowing Sample Mesh
            const sGeo = new THREE.OctahedronGeometry(0.8, 0);
            const sMat = new THREE.MeshStandardMaterial({
                color: def.color,
                emissive: def.color,
                emissiveIntensity: 0.8,
                roughness: 0.2,
                metalness: 0.9
            });

            const sampleMesh = new THREE.Mesh(sGeo, sMat);
            sampleMesh.position.set(def.pos.x, y + 1.2, def.pos.z);
            this.scene.add(sampleMesh);

            // Vertical Beacon Light Pillar
            const beaconGeo = new THREE.CylinderGeometry(0.1, 0.1, 15, 8);
            beaconGeo.translate(0, 7.5, 0);
            const beaconMat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.35
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

    update(deltaTime) {
        // Animate floating and spinning sample markers
        this.samples.forEach(s => {
            if (!s.collected) {
                s.mesh.rotation.y += deltaTime * 1.5;
                s.mesh.position.y = s.y + 1.2 + Math.sin(Date.now() * 0.003 + s.id) * 0.2;
            }
        });

        // Drift ambient dust particles with Mars wind
        if (this.dustParticles) {
            const posAttr = this.dustParticles.geometry.attributes.position;
            const windSpeed = this.sandstormActive ? 30 : 6;

            for (let i = 0; i < posAttr.count; i++) {
                let x = posAttr.getX(i) + windSpeed * deltaTime;
                let y = posAttr.getY(i) - (this.sandstormActive ? 2 : 0.5) * deltaTime;
                let z = posAttr.getZ(i) + (windSpeed * 0.3) * deltaTime;

                if (x > 150) x = -150;
                if (y < 0) y = 30;
                if (z > 150) z = -150;

                posAttr.setXYZ(i, x, y, z);
            }
            posAttr.needsUpdate = true;
        }
    }
}
