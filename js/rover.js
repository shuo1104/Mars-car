/**
 * Wanderer-1 Mars Rover 3D Model & Physics System
 * Built programmatically with Three.js primitives
 * Enhanced with Dynamic Suspension Physics, Rocker-Bogie Mechanics, and Laser Target Aiming
 */
class MarsRover {
    constructor(scene) {
        this.scene = scene;
        this.mesh = new THREE.Group();
        
        // Motion parameters
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Orientation in radians
        this.speed = 0;
        this.lastSpeed = 0;
        this.accelerationVal = 0;
        this.steeringAngle = 0;
        this.maxSpeed = 14.0; // km/h scaled
        this.reverseMaxSpeed = -6.0;
        this.acceleration = 15.0;
        this.friction = 8.0;
        this.turnSpeed = 1.8;
        
        // Dynamic Suspension & Juice Variables
        this.pitch = 0;
        this.roll = 0;
        this.suspensionPitch = 0;
        this.suspensionRoll = 0;
        this.bounceOffset = 0;
        this.bounceVelocity = 0;

        // Subcomponents references for animation
        this.wheels = [];
        this.steeredWheelGroups = [];
        this.solarPanels = [];
        this.solarFoldAngle = 0; // 0 = folded, 1 = open
        this.isChargingMode = false;
        this.headlightsOn = false;
        this.headlights = [];
        this.laserMesh = null;
        this.camHead = null;
        this.antennaDish = null;
        this.isScanning = false;
        this.scanTarget = null;
        this.scanProgress = 0;

        this.buildRoverMesh();
        this.scene.add(this.mesh);
    }

    buildRoverMesh() {
        // Materials
        const goldFoilMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 0.9,
            roughness: 0.2,
            emissive: 0x443300,
            emissiveIntensity: 0.2
        });

        const metalBodyMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.8,
            roughness: 0.25
        });

        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.5,
            roughness: 0.5
        });

        const solarMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            emissive: 0x0284c7,
            emissiveIntensity: 0.5,
            roughness: 0.1,
            metalness: 0.95
        });

        const lensMat = new THREE.MeshStandardMaterial({
            color: 0x00e5ff,
            emissive: 0x00e5ff,
            emissiveIntensity: 0.9
        });

        // 1. Chassis Core Box (Gold foil insulated avionics body)
        const chassisGeo = new THREE.BoxGeometry(1.6, 0.8, 2.2);
        const chassis = new THREE.Mesh(chassisGeo, goldFoilMat);
        chassis.position.y = 0.9;
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        this.mesh.add(chassis);

        // Frame accents
        const rimGeo = new THREE.BoxGeometry(1.7, 0.2, 2.3);
        const rim = new THREE.Mesh(rimGeo, metalBodyMat);
        rim.position.y = 0.5;
        this.mesh.add(rim);

        // 2. Solar Panel Arrays (Left & Right Wings)
        const panelShapeGeo = new THREE.BoxGeometry(1.2, 0.05, 1.8);
        
        // Left Solar Panel Group (hinged at chassis edge)
        this.leftSolarPivot = new THREE.Group();
        this.leftSolarPivot.position.set(-0.8, 1.35, 0);
        const leftPanel = new THREE.Mesh(panelShapeGeo, solarMat);
        leftPanel.position.set(-0.6, 0, 0);
        leftPanel.castShadow = true;
        this.leftSolarPivot.add(leftPanel);
        this.mesh.add(this.leftSolarPivot);
        this.solarPanels.push(this.leftSolarPivot);

        // Right Solar Panel Group
        this.rightSolarPivot = new THREE.Group();
        this.rightSolarPivot.position.set(0.8, 1.35, 0);
        const rightPanel = new THREE.Mesh(panelShapeGeo, solarMat);
        rightPanel.position.set(0.6, 0, 0);
        rightPanel.castShadow = true;
        this.rightSolarPivot.add(rightPanel);
        this.mesh.add(this.rightSolarPivot);
        this.solarPanels.push(this.rightSolarPivot);

        // 3. Camera Mast Tower (Mastcam-Z & SuperCam Laser)
        const mastGroup = new THREE.Group();
        mastGroup.position.set(0.4, 1.3, -0.7);

        const mastPoleGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8);
        const mastPole = new THREE.Mesh(mastPoleGeo, metalBodyMat);
        mastPole.position.y = 0.6;
        mastGroup.add(mastPole);

        // Camera Head Box
        const camHeadGeo = new THREE.BoxGeometry(0.4, 0.25, 0.3);
        this.camHead = new THREE.Mesh(camHeadGeo, metalBodyMat);
        this.camHead.position.y = 1.2;
        
        // Dual Stereo Lenses
        const lensGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12);
        lensGeo.rotateX(Math.PI / 2);
        const leftLens = new THREE.Mesh(lensGeo, lensMat);
        leftLens.position.set(-0.1, 0, -0.15);
        const rightLens = new THREE.Mesh(lensGeo, lensMat);
        rightLens.position.set(0.1, 0, -0.15);
        this.camHead.add(leftLens);
        this.camHead.add(rightLens);

        // Laser Scan Aperture in Center
        const laserApertureGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 12);
        laserApertureGeo.rotateX(Math.PI / 2);
        const laserAperture = new THREE.Mesh(laserApertureGeo, new THREE.MeshBasicMaterial({ color: 0xff0055 }));
        laserAperture.position.set(0, -0.05, -0.15);
        this.camHead.add(laserAperture);

        mastGroup.add(this.camHead);
        this.mesh.add(mastGroup);

        // 4. Laser Beam Particle Effect Mesh (Hidden by default)
        const laserBeamGeo = new THREE.CylinderGeometry(0.03, 0.18, 12, 8);
        laserBeamGeo.rotateX(Math.PI / 2);
        laserBeamGeo.translate(0, 0, -6); // Beam points forward
        this.laserMesh = new THREE.Mesh(laserBeamGeo, new THREE.MeshBasicMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.85
        }));
        this.laserMesh.position.set(0.4, 2.45, -0.85);
        this.laserMesh.visible = false;
        this.mesh.add(this.laserMesh);

        // 5. LED Headlights (Dual forward spotlights)
        const lightGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12);
        lightGeo.rotateX(Math.PI / 2);
        
        [-0.5, 0.5].forEach(x => {
            const hMesh = new THREE.Mesh(lightGeo, lensMat);
            hMesh.position.set(x, 0.7, -1.12);
            this.mesh.add(hMesh);

            const spotLight = new THREE.SpotLight(0xffffff, 0); // Start off
            spotLight.position.set(x, 0.7, -1.15);
            spotLight.target.position.set(x, 0, -10);
            spotLight.angle = Math.PI / 5;
            spotLight.penumbra = 0.4;
            spotLight.distance = 30;
            spotLight.castShadow = true;

            this.mesh.add(spotLight);
            this.mesh.add(spotLight.target);
            this.headlights.push(spotLight);
        });

        // 6. High-Gain Antenna Dish
        const dishGeo = new THREE.CylinderGeometry(0.35, 0.05, 0.1, 16);
        dishGeo.rotateX(-Math.PI / 4);
        this.antennaDish = new THREE.Mesh(dishGeo, goldFoilMat);
        this.antennaDish.position.set(-0.5, 1.6, 0.6);
        this.mesh.add(this.antennaDish);

        // 7. Rocker-Bogie Suspension & 6 Wheels (3 on Left, 3 on Right)
        const wheelRadius = 0.35;
        const wheelThickness = 0.28;
        const wheelPositions = [
            { x: -1.15, y: wheelRadius, z: -1.0, steered: true },  // Front Left
            { x: -1.2,  y: wheelRadius, z: 0.0,  steered: false }, // Mid Left
            { x: -1.15, y: wheelRadius, z: 1.0,  steered: true },  // Rear Left
            { x: 1.15,  y: wheelRadius, z: -1.0, steered: true },  // Front Right
            { x: 1.2,   y: wheelRadius, z: 0.0,  steered: false }, // Mid Right
            { x: 1.15,  y: wheelRadius, z: 1.0,  steered: true }   // Rear Right
        ];

        wheelPositions.forEach(pos => {
            const pivotGroup = new THREE.Group();
            pivotGroup.position.set(pos.x, pos.y, pos.z);

            // Wheel Mesh
            const wGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 16);
            wGeo.rotateZ(Math.PI / 2);
            
            const tireGroup = new THREE.Group();
            const tireMesh = new THREE.Mesh(wGeo, wheelMat);
            tireMesh.castShadow = true;
            tireGroup.add(tireMesh);

            // Metallic Rim cap
            const capGeo = new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, wheelThickness + 0.02, 8);
            capGeo.rotateZ(Math.PI / 2);
            const capMesh = new THREE.Mesh(capGeo, metalBodyMat);
            tireGroup.add(capMesh);

            pivotGroup.add(tireGroup);
            this.mesh.add(pivotGroup);

            this.wheels.push(tireGroup);
            if (pos.steered) {
                this.steeredWheelGroups.push({ group: pivotGroup, isRear: pos.z > 0 });
            }
        });
    }

    setHeadlights(on) {
        this.headlightsOn = on;
        this.headlights.forEach(light => {
            light.intensity = on ? 4.5 : 0;
        });
    }

    setChargingMode(isCharging) {
        this.isChargingMode = isCharging;
    }

    update(deltaTime, inputs, terrainHeightFunc) {
        // Compute acceleration derivative for squat/nosedive simulation
        this.accelerationVal = (this.speed - this.lastSpeed) / Math.max(0.001, deltaTime);
        this.lastSpeed = this.speed;

        // Handle Solar charging mode wing unfolding animation
        const targetAngle = this.isChargingMode ? -Math.PI / 3 : 0;
        this.leftSolarPivot.rotation.z += (targetAngle - this.leftSolarPivot.rotation.z) * 0.1;
        this.rightSolarPivot.rotation.z += (-targetAngle - this.rightSolarPivot.rotation.z) * 0.1;

        if (this.isChargingMode) {
            this.speed += (-this.speed) * this.friction * deltaTime;
        } else {
            // Acceleration & Braking
            if (inputs.forward) {
                this.speed += this.acceleration * deltaTime;
                if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
            } else if (inputs.backward) {
                this.speed -= this.acceleration * deltaTime;
                if (this.speed < this.reverseMaxSpeed) this.speed = this.reverseMaxSpeed;
            } else {
                if (this.speed > 0) {
                    this.speed -= this.friction * deltaTime;
                    if (this.speed < 0) this.speed = 0;
                } else if (this.speed < 0) {
                    this.speed += this.friction * deltaTime;
                    if (this.speed > 0) this.speed = 0;
                }
            }

            if (inputs.brake) {
                this.speed += (-this.speed) * (this.friction * 2.8) * deltaTime;
            }

            // Steering
            const steerDir = (this.speed < 0) ? -1 : 1;
            if (inputs.left) {
                this.rotation += this.turnSpeed * steerDir * deltaTime * (Math.abs(this.speed) / this.maxSpeed + 0.4);
                this.steeringAngle = Math.min(0.55, this.steeringAngle + deltaTime * 2.5);
            } else if (inputs.right) {
                this.rotation -= this.turnSpeed * steerDir * deltaTime * (Math.abs(this.speed) / this.maxSpeed + 0.4);
                this.steeringAngle = Math.max(-0.55, this.steeringAngle - deltaTime * 2.5);
            } else {
                this.steeringAngle += (-this.steeringAngle) * 5.0 * deltaTime;
            }
        }

        // Translate Rover Position
        const speedMS = (this.speed / 3.6);
        this.position.x -= Math.sin(this.rotation) * speedMS * deltaTime;
        this.position.z -= Math.cos(this.rotation) * speedMS * deltaTime;

        // Ground Height & Dynamic Suspension Springs
        const y = terrainHeightFunc(this.position.x, this.position.z);
        
        // Terrain slope pitch & roll sampling
        const frontY = terrainHeightFunc(this.position.x - Math.sin(this.rotation) * 1.4, this.position.z - Math.cos(this.rotation) * 1.4);
        const backY  = terrainHeightFunc(this.position.x + Math.sin(this.rotation) * 1.4, this.position.z + Math.cos(this.rotation) * 1.4);
        const sideY  = terrainHeightFunc(this.position.x + Math.cos(this.rotation) * 1.2, this.position.z - Math.sin(this.rotation) * 1.2);

        const targetPitch = (frontY - backY) * 0.35;
        const targetRoll  = (sideY - y) * 0.35;

        // Add Juice: Nosedive on brake (-accel), Squat on accel (+accel), Body roll into turns
        const nosedivePitch = -this.accelerationVal * 0.008;
        const steerBodyRoll = -this.steeringAngle * (this.speed / this.maxSpeed) * 0.25;

        // Smooth suspension spring interpolation
        this.suspensionPitch += (targetPitch + nosedivePitch - this.suspensionPitch) * 0.15;
        this.suspensionRoll  += (targetRoll + steerBodyRoll - this.suspensionRoll) * 0.15;

        // Rough terrain bounce
        if (Math.abs(this.speed) > 4.0) {
            this.bounceVelocity += (Math.random() - 0.5) * 0.08 * (Math.abs(this.speed) / this.maxSpeed);
        }
        this.bounceOffset += this.bounceVelocity;
        this.bounceVelocity += (-this.bounceOffset) * 0.2; // spring return
        this.bounceVelocity *= 0.85; // damping

        this.position.y = y + Math.max(-0.2, Math.min(0.2, this.bounceOffset));
        this.pitch = this.suspensionPitch;
        this.roll  = this.suspensionRoll;

        // Apply transformations to Three.js Mesh
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
        this.mesh.rotation.x = this.pitch;
        this.mesh.rotation.z = this.roll;

        // Rotate Wheels and Ackermann Steer Wheel Pivots
        this.steeredWheelGroups.forEach(sw => {
            const angle = sw.isRear ? -this.steeringAngle * 0.7 : this.steeringAngle;
            sw.group.rotation.y = angle;
        });

        // Rotate tires along rolling axis
        const wheelRollDelta = (speedMS * deltaTime) / 0.35;
        this.wheels.forEach(w => {
            w.rotation.x += wheelRollDelta;
        });

        // Slow tracking rotation for High-Gain Antenna Dish
        if (this.antennaDish) {
            this.antennaDish.rotation.y += deltaTime * 0.2;
        }

        // Animate Laser Beam and Camera Head tracking when scanning
        if (this.isScanning) {
            this.laserMesh.visible = true;
            this.laserMesh.material.opacity = 0.7 + Math.sin(Date.now() * 0.03) * 0.25;
            if (this.camHead) {
                this.camHead.rotation.y = Math.sin(Date.now() * 0.005) * 0.15;
            }
        } else {
            this.laserMesh.visible = false;
            if (this.camHead) {
                this.camHead.rotation.y += (-this.camHead.rotation.y) * 0.1;
            }
        }
    }
}
