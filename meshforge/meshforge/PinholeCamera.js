import { Vector, Matrix } from './index.js';

export class PinholeCamera {
    constructor(config = {}) {
        // Camera position and orientation
        this.position = config.position || new Vector.Vec3(0, 0, 5);
        this.target = config.target || new Vector.Vec3(0, 0, 0);
        this.up = config.up || new Vector.Vec3(0, 1, 0);
        
        // Camera intrinsics
        this.fov = config.fov || Math.PI / 4; // 45 degrees
        this.aspect = config.aspect || 1;
        this.near = config.near || 0.1;
        this.far = config.far || 1000;
        
        // View matrices
        this.viewMatrix = Matrix.Mat4.identity();
        this.projectionMatrix = Matrix.Mat4.identity();
        
        // Update matrices
        this.updateViewMatrix();
        this.updateProjectionMatrix();
    }

    updateViewMatrix() {
        // Calculate camera basis vectors
        const forward = this.position.clone().sub(this.target).normalize();
        const right = this.up.clone().cross(forward).normalize();
        const up = forward.clone().cross(right);

        // Create view matrix
        this.viewMatrix = new Matrix.Mat4([
            right.x, up.x, forward.x, 0,
            right.y, up.y, forward.y, 0,
            right.z, up.z, forward.z, 0,
            -right.dot(this.position),
            -up.dot(this.position),
            -forward.dot(this.position),
            1
        ]);
    }

    updateProjectionMatrix() {
        const f = 1.0 / Math.tan(this.fov / 2);
        const rangeInv = 1 / (this.near - this.far);

        this.projectionMatrix = new Matrix.Mat4([
            f / this.aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (this.near + this.far) * rangeInv, -1,
            0, 0, this.near * this.far * rangeInv * 2, 0
        ]);
    }

    lookAt(target) {
        this.target = target;
        this.updateViewMatrix();
    }

    setPosition(position) {
        this.position = position;
        this.updateViewMatrix();
    }

    setAspect(aspect) {
        this.aspect = aspect;
        this.updateProjectionMatrix();
    }

    getViewProjectionMatrix() {
        return this.projectionMatrix.multiply(this.viewMatrix);
    }

    // Camera movement methods
    orbit(deltaX, deltaY, radius) {
        const theta = deltaX * 0.01;
        const phi = deltaY * 0.01;
        
        // Calculate new camera position
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        
        this.position.x = radius * cosPhi * sinTheta;
        this.position.y = radius * sinPhi;
        this.position.z = radius * cosPhi * cosTheta;
        
        this.updateViewMatrix();
    }

    zoom(factor) {
        const dir = this.position.clone().sub(this.target);
        const newLen = dir.length() * factor;
        dir.normalize().mul(newLen);
        this.position = this.target.clone().add(dir);
        this.updateViewMatrix();
    }

    pan(deltaX, deltaY) {
        const right = new Vector.Vec3(
            this.viewMatrix.get(0, 0),
            this.viewMatrix.get(1, 0),
            this.viewMatrix.get(2, 0)
        );
        const up = new Vector.Vec3(
            this.viewMatrix.get(0, 1),
            this.viewMatrix.get(1, 1),
            this.viewMatrix.get(2, 1)
        );

        const moveX = right.mul(deltaX * 0.01);
        const moveY = up.mul(deltaY * 0.01);

        this.position.add(moveX).add(moveY);
        this.target.add(moveX).add(moveY);
        
        this.updateViewMatrix();
    }
}