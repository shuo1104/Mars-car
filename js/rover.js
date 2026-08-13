/**
 * Wanderer-1 Mars Rover 3D Model & Driving Physics System
 * Features Dynamic Suspension Spring Physics, Sand Drift / Skid Mechanics, and Ackermann Steering
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
        this.maxSpeed = 16.0; // km/h scaled for responsive driving
        this.reverseMaxSpeed = -7.0;
        this.acceleration = 16.0;
        this.friction = 7.0;
        this.turnSpeed = 1.95;

        // Sand Skid & Drift Mechanics
        this.isDrifting = false;
        this.driftFactor = 0;
        
        // Dynamic Suspension Springs & Juice Variables
        this.pitch = 0;
        this.roll = 0;
        this.suspensionPitch = 0;
        this.suspensionRoll = 0;
        this.bounceOffset = 0;
        this.bounceVelocity = 0;

        // Subcomponents references
        this.wheels = [];
        this.steeredWheelGroups = [];
        this.headlightsOn = false;
        this.headlights = [];
        this.antennaDish = null;

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

        // 2. Solar Panels Wings
        const panelShapeGeo = new THREE.BoxGeometry(1.2, 0.05, 1.8);
        
        const leftPanel = new THREE.Mesh(panelShapeGeo, solarMat);
        leftPanel.position.set(-1.4, 1.35, 0);
        leftPanel.castShadow = true;
        this.mesh.add(leftPanel);

        const rightPanel = new THREE.Mesh(panelShapeGeo, solarMat);
        rightPanel.position.set(1.4, 1.35, 0);
        rightPanel.castShadow = true;
        this.mesh.add(rightPanel);

        // 3. Camera Mast Tower
        const mastGroup = new THREE.Group();
        mastGroup.position.set(0.4, 1.3, -0.7);

        const mastPoleGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8);
        const mastPole = new THREE.Mesh(mastPoleGeo, metalBodyMat);
        mastPole.position.y = 0.6;
        mastGroup.add(mastPole);

        const camHeadGeo = new THREE.BoxGeometry(0.4, 0.25, 0.3);
        const camHead = new THREE.Mesh(camHeadGeo, metalBodyMat);
        camHead.position.y = 1.2;
        
        const lensGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12);
        lensGeo.rotateX(Math.PI / 2);
        const leftLens = new THREE.Mesh(lensGeo, lensMat);
        leftLens.position.set(-0.1, 0, -0.15);
        const rightLens = new THREE.Mesh(lensGeo, lensMat);
        rightLens.position.set(0.1, 0, -0.15);
        camHead.add(leftLens);
        camHead.add(rightLens);

        mastGroup.add(camHead);
        this.mesh.add(mastGroup);

        // 4. LED Headlights [L Key Controls]
        const lightGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12);
        lightGeo.rotateX(Math.PI / 2);
        
        [-0.5, 0.5].forEach(x => {
            const hMesh = new THREE.Mesh(lightGeo, lensMat);
            hMesh.position.set(x, 0.7, -1.12);
            this.mesh.add(hMesh);

            const spotLight = new THREE.SpotLight(0xffffff, 0);
            spotLight.position.set(x, 0.7, -1.15);
            spotLight.target.position.set(x, 0, -10);
            spotLight.angle = Math.PI / 5;
            spotLight.penumbra = 0.4;
            spotLight.distance = 32;
            spotLight.castShadow = true;

            this.mesh.add(spotLight);
            this.mesh.add(spotLight.target);
            this.headlights.push(spotLight);
        });

        // 5. High-Gain Antenna Dish
        const dishGeo = new THREE.CylinderGeometry(0.35, 0.05, 0.1, 16);
        dishGeo.rotateX(-Math.PI / 4);
        this.antennaDish = new THREE.Mesh(dishGeo, goldFoilMat);
        this.antennaDish.position.set(-0.5, 1.6, 0.6);
        this.mesh.add(this.antennaDish);

        // 6. Rocker-Bogie Suspension & 6 Wheels
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

            const wGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 16);
            wGeo.rotateZ(Math.PI / 2);
            
            const tireGroup = new THREE.Group();
            const tireMesh = new THREE.Mesh(wGeo, wheelMat);
            tireMesh.castShadow = true;
            tireGroup.add(tireMesh);

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

    update(deltaTime, inputs, terrainHeightFunc) {
        // Calculate acceleration derivative
        this.accelerationVal = (this.speed - this.lastSpeed) / Math.max(0.001, deltaTime);
        this.lastSpeed = this.speed;

        // Acceleration & Braking (WASD / Arrow Keys)
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

        // Steering & Sand Skid Mechanics
        const steerDir = (this.speed < 0) ? -1 : 1;
        const speedRatio = Math.abs(this.speed) / this.maxSpeed;

        if (inputs.left) {
            this.rotation += this.turnSpeed * steerDir * deltaTime * (speedRatio * 0.7 + 0.45);
            this.steeringAngle = Math.min(0.58, this.steeringAngle + deltaTime * 2.8);
        } else if (inputs.right) {
            this.rotation -= this.turnSpeed * steerDir * deltaTime * (speedRatio * 0.7 + 0.45);
            this.steeringAngle = Math.max(-0.58, this.steeringAngle - deltaTime * 2.8);
        } else {
            this.steeringAngle += (-this.steeringAngle) * 5.5 * deltaTime;
        }

        // Sand Drift on fast sharp turning
        if (speedRatio > 0.45 && Math.abs(this.steeringAngle) > 0.35) {
            this.isDrifting = true;
            this.driftFactor = Math.min(1.0, this.driftFactor + deltaTime * 3.0);
        } else {
            this.isDrifting = false;
            this.driftFactor = Math.max(0, this.driftFactor - deltaTime * 4.0);
        }

        // Position translation with lateral drift momentum
        const speedMS = (this.speed / 3.6);
        const forwardX = -Math.sin(this.rotation);
        const forwardZ = -Math.cos(this.rotation);

        const sideX = Math.cos(this.rotation);
        const sideZ = -Math.sin(this.rotation);
        const driftSign = Math.sign(this.steeringAngle);

        const moveX = (forwardX * speedMS) + (sideX * driftSign * speedMS * 0.35 * this.driftFactor);
        const moveZ = (forwardZ * speedMS) + (sideZ * driftSign * speedMS * 0.35 * this.driftFactor);

        this.position.x += moveX * deltaTime;
        this.position.z += moveZ * deltaTime;

        // Ground Height & Suspension Springs
        const y = terrainHeightFunc(this.position.x, this.position.z);
        
        const frontY = terrainHeightFunc(this.position.x - Math.sin(this.rotation) * 1.4, this.position.z - Math.cos(this.rotation) * 1.4);
        const backY  = terrainHeightFunc(this.position.x + Math.sin(this.rotation) * 1.4, this.position.z + Math.cos(this.rotation) * 1.4);
        const sideY  = terrainHeightFunc(this.position.x + Math.cos(this.rotation) * 1.2, this.position.z - Math.sin(this.rotation) * 1.2);

        const targetPitch = (frontY - backY) * 0.35;
        const targetRoll  = (sideY - y) * 0.35;

        const nosedivePitch = -this.accelerationVal * 0.009;
        const steerBodyRoll = -this.steeringAngle * speedRatio * 0.3 + (driftSign * this.driftFactor * 0.15);

        this.suspensionPitch += (targetPitch + nosedivePitch - this.suspensionPitch) * 0.18;
        this.suspensionRoll  += (targetRoll + steerBodyRoll - this.suspensionRoll) * 0.18;

        if (Math.abs(this.speed) > 3.5) {
            this.bounceVelocity += (Math.random() - 0.5) * 0.09 * speedRatio;
        }
        this.bounceOffset += this.bounceVelocity;
        this.bounceVelocity += (-this.bounceOffset) * 0.22;
        this.bounceVelocity *= 0.82;

        this.position.y = y + Math.max(-0.25, Math.min(0.25, this.bounceOffset));
        this.pitch = this.suspensionPitch;
        this.roll  = this.suspensionRoll;

        // Apply transformations to Mesh
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
        this.mesh.rotation.x = this.pitch;
        this.mesh.rotation.z = this.roll;

        // Rotate Wheels and Ackermann Steer Pivots
        this.steeredWheelGroups.forEach(sw => {
            const angle = sw.isRear ? -this.steeringAngle * 0.65 : this.steeringAngle;
            sw.group.rotation.y = angle;
        });

        // Rotate tires along rolling axis
        const wheelRollDelta = (speedMS * deltaTime) / 0.35;
        this.wheels.forEach(w => {
            w.rotation.x += wheelRollDelta;
        });

        if (this.antennaDish) {
            this.antennaDish.rotation.y += deltaTime * 0.2;
        }
    }
}
