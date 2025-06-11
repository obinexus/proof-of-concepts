import {  Vector,Matrix} from './index.js';

/**
 * A comprehensive 3D Cube implementation using Vector and Matrix libraries
 * @module Cube
 */
export class Cube {
    /**
     * Create a new cube
     * @param {Object} config Configuration object
     * @param {Vector.Vec3} config.position Initial position
     * @param {Vector.Vec3} config.rotation Initial rotation (in radians)
     * @param {Vector.Vec3} config.scale Scale factors
     * @param {string} config.texture Path to texture image (optional)
     */
    constructor(config = {}) {
        // Core properties
        this.position = config.position || new Vector.Vec3(0, 0, 0);
        this.rotation = config.rotation || new Vector.Vec3(0, 0, 0);
        this.scale = config.scale || new Vector.Vec3(1, 1, 1);
        this.velocity = new Vector.Vec3(0, 0, 0);
        this.acceleration = new Vector.Vec3(0, 0, 0);

        // Physics properties
        this.mass = config.mass || 1;
        this.friction = config.friction || 0.1;
        this.elasticity = config.elasticity || 0.8;

        // Rendering properties
        this.texture = config.texture || null;
        this.color = config.color || '#ffffff';
        this.wireframe = config.wireframe || false;

        // Initialize geometry
        this.vertices = this.createVertices();
        this.faces = this.createFaces();
        this.normals = this.calculateNormals();

        // Create transformation matrices
        this.modelMatrix = Matrix.Mat4.identity();
        this.updateModelMatrix();
    }

    /**
     * Create cube vertices
     * @returns {Array<Vector.Vec3>} Array of vertices
     */
    createVertices() {
        return [
            new Vector.Vec3(-0.5, -0.5, -0.5), // 0: Back-bottom-left
            new Vector.Vec3(0.5, -0.5, -0.5),  // 1: Back-bottom-right
            new Vector.Vec3(0.5, 0.5, -0.5),   // 2: Back-top-right
            new Vector.Vec3(-0.5, 0.5, -0.5),  // 3: Back-top-left
            new Vector.Vec3(-0.5, -0.5, 0.5),  // 4: Front-bottom-left
            new Vector.Vec3(0.5, -0.5, 0.5),   // 5: Front-bottom-right
            new Vector.Vec3(0.5, 0.5, 0.5),    // 6: Front-top-right
            new Vector.Vec3(-0.5, 0.5, 0.5)    // 7: Front-top-left
        ];
    }

    /**
     * Create cube faces
     * @returns {Array<Object>} Array of faces with vertices and UVs
     */
    createFaces() {
        return [
            { // Front face
                vertices: [4, 5, 6, 7],
                uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
            },
            { // Back face
                vertices: [1, 0, 3, 2],
                uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
            },
            { // Top face
                vertices: [7, 6, 2, 3],
                uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
            },
            { // Bottom face
                vertices: [0, 1, 5, 4],
                uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
            },
            { // Right face
                vertices: [5, 1, 2, 6],
                uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
            },
            { // Left face
                vertices: [0, 4, 7, 3],
                uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
            }
        ];
    }

    /**
     * Calculate face normals
     * @returns {Array<Vector.Vec3>} Array of face normals
     */
    calculateNormals() {
        return this.faces.map(face => {
            const v1 = this.vertices[face.vertices[1]].clone().sub(this.vertices[face.vertices[0]]);
            const v2 = this.vertices[face.vertices[2]].clone().sub(this.vertices[face.vertices[0]]);
            return v1.cross(v2).normalize();
        });
    }

    /**
     * Update model matrix based on position, rotation, and scale
     */
    updateModelMatrix() {
        const translation = Matrix.Mat4.translation(
            this.position.x,
            this.position.y,
            this.position.z
        );

        const rotationX = Matrix.Mat4.rotationX(this.rotation.x);
        const rotationY = Matrix.Mat4.rotationY(this.rotation.y);
        const rotationZ = Matrix.Mat4.rotationZ(this.rotation.z);

        const scale = Matrix.Mat4.scale(
            this.scale.x,
            this.scale.y,
            this.scale.z
        );

        // Combine transformations: Translation * Rotation * Scale
        this.modelMatrix = translation
            .multiply(rotationX)
            .multiply(rotationY)
            .multiply(rotationZ)
            .multiply(scale);
    }

    /**
     * Transform a vertex by the model matrix
     * @param {Vector.Vec3} vertex Vertex to transform
     * @returns {Vector.Vec3} Transformed vertex
     */
    transformVertex(vertex) {
        const v = new Vector.Vec3(vertex.x, vertex.y, vertex.z);
        const transformed = this.modelMatrix.multiply(new Matrix.Mat4([
            v.x, v.y, v.z, 1,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0
        ]));
        return new Vector.Vec3(
            transformed.get(0, 0),
            transformed.get(1, 0),
            transformed.get(2, 0)
        );
    }

    /**
     * Project a 3D point to 2D screen space
     * @param {Vector.Vec3} point 3D point
     * @param {Matrix.Mat4} projectionMatrix Projection matrix
     * @param {Object} viewport Viewport dimensions
     * @returns {Vector.Vec2} 2D screen coordinates
     */
    projectVertex(point, projectionMatrix, viewport) {
        const projected = projectionMatrix.multiply(new Matrix.Mat4([
            point.x, point.y, point.z, 1,
            0, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 0, 0
        ]));

        const w = projected.get(3, 0);
        const x = (projected.get(0, 0) / w + 1) * viewport.width / 2;
        const y = (-projected.get(1, 0) / w + 1) * viewport.height / 2;

        return new Vector.Vec2(x, y);
    }

    /**
     * Update cube physics
     * @param {number} deltaTime Time since last update in seconds
     */
    update(deltaTime) {
        // Update velocity with acceleration
        this.velocity.add(this.acceleration.clone().mul(deltaTime));

        // Apply friction
        this.velocity.mul(1 - this.friction * deltaTime);

        // Update position with velocity
        this.position.add(this.velocity.clone().mul(deltaTime));

        // Update transformation matrix
        this.updateModelMatrix();
    }

    /**
     * Render cube to canvas context
     * @param {CanvasRenderingContext2D} ctx Canvas context
     * @param {Matrix.Mat4} projectionMatrix Projection matrix
     * @param {Object} viewport Viewport dimensions
     */
    render(ctx, projectionMatrix, viewport) {
        // Transform vertices
        const transformedVertices = this.vertices.map(v => this.transformVertex(v));
        const projectedVertices = transformedVertices.map(v => 
            this.projectVertex(v, projectionMatrix, viewport)
        );

        // Sort faces by depth (painter's algorithm)
        const sortedFaces = [...this.faces]
            .map((face, index) => ({
                ...face,
                depth: this.calculateFaceDepth(transformedVertices, face.vertices),
                normal: this.normals[index]
            }))
            .sort((a, b) => b.depth - a.depth);

        // Render faces
        sortedFaces.forEach(face => {
            // Back-face culling
            const normal = face.normal;
            const viewVector = transformedVertices[face.vertices[0]].clone().normalize();
            if (normal.dot(viewVector) < 0) {
                this.renderFace(ctx, projectedVertices, face);
            }
        });
    }

    /**
     * Calculate average depth of a face
     * @param {Array<Vector.Vec3>} vertices Transformed vertices
     * @param {Array<number>} faceIndices Face vertex indices
     * @returns {number} Average depth
     */
    calculateFaceDepth(vertices, faceIndices) {
        return faceIndices.reduce((sum, index) => 
            sum + vertices[index].z, 0
        ) / faceIndices.length;
    }

    /**
     * Render a single face
     * @param {CanvasRenderingContext2D} ctx Canvas context
     * @param {Array<Vector.Vec2>} projectedVertices Projected vertices
     * @param {Object} face Face to render
     */
    renderFace(ctx, projectedVertices, face) {
        ctx.beginPath();
        ctx.moveTo(
            projectedVertices[face.vertices[0]].x,
            projectedVertices[face.vertices[0]].y
        );

        for (let i = 1; i < face.vertices.length; i++) {
            ctx.lineTo(
                projectedVertices[face.vertices[i]].x,
                projectedVertices[face.vertices[i]].y
            );
        }

        ctx.closePath();

        if (this.texture && face.uvs) {
            // Apply texture mapping
            this.applyTextureToFace(ctx, projectedVertices, face);
        } else {
            // Solid color fill
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        if (this.wireframe) {
            ctx.strokeStyle = '#000';
            ctx.stroke();
        }
    }

    /**
     * Apply texture to face using perspective correction
     * @param {CanvasRenderingContext2D} ctx Canvas context
     * @param {Array<Vector.Vec2>} projectedVertices Projected vertices
     * @param {Object} face Face to texture
     */
    applyTextureToFace(ctx, projectedVertices, face) {
        if (!this.texture) return;

        const sourcePoints = face.uvs.map(uv => ({
            x: uv[0] * this.texture.width,
            y: uv[1] * this.texture.height
        }));

        const destPoints = face.vertices.map(index => ({
            x: projectedVertices[index].x,
            y: projectedVertices[index].y
        }));

        // Create temporary canvas for texture transformation
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.texture.width;
        tempCanvas.height = this.texture.height;

        // Draw texture to temporary canvas
        tempCtx.drawImage(this.texture, 0, 0);

        // Apply perspective transform
        const transform = this.getPerspectiveTransform(sourcePoints, destPoints);
        ctx.save();
        ctx.transform(
            transform.a, transform.b,
            transform.c, transform.d,
            transform.e, transform.f
        );
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    }

    /**
     * Calculate perspective transform matrix
     * @param {Array<Object>} src Source points
     * @param {Array<Object>} dst Destination points
     * @returns {Object} Transform matrix coefficients
     */
    getPerspectiveTransform(src, dst) {
        // Implementation of perspective transform matrix calculation
        // This is a simplified version - you might want to use a proper perspective
        // transform library for more accurate results
        const dx1 = src[1].x - src[0].x;
        const dy1 = src[1].y - src[0].y;
        const dx2 = src[2].x - src[0].x;
        const dy2 = src[2].y - src[0].y;
        const sx = src[0].x;
        const sy = src[0].y;

        const dx3 = dst[1].x - dst[0].x;
        const dy3 = dst[1].y - dst[0].y;
        const dx4 = dst[2].x - dst[0].x;
        const dy4 = dst[2].y - dst[0].y;

        return {
            a: dx3 / dx1,
            b: dy3 / dx1,
            c: dx4 / dy2,
            d: dy4 / dy2,
            e: dst[0].x - (dx3 * sx) / dx1,
            f: dst[0].y - (dy3 * sy) / dx1
        };
    }

    /**
     * Check collision with another cube
     * @param {Cube} other Other cube to check collision with
     * @returns {boolean} True if colliding
     */
    isColliding(other) {
        // Simple AABB collision detection
        const dx = Math.abs(this.position.x - other.position.x);
        const dy = Math.abs(this.position.y - other.position.y);
        const dz = Math.abs(this.position.z - other.position.z);

        const combinedScale = new Vector.Vec3(
            (this.scale.x + other.scale.x) / 2,
            (this.scale.y + other.scale.y) / 2,
            (this.scale.z + other.scale.z) / 2
        );

        return (
            dx < combinedScale.x &&
            dy < combinedScale.y &&
            dz < combinedScale.z
        );
    }

    /**
     * Handle collision response
     * @param {Cube} other Other cube involved in collision
     */
    resolveCollision(other) {
        // Calculate collision normal
        const normal = this.position.clone().sub(other.position).normalize();

        // Calculate relative velocity
        const relativeVelocity = this.velocity.clone().sub(other.velocity);

        // Calculate impulse scalar
        const impulseScalar = -(1 + this.elasticity) * relativeVelocity.dot(normal) /
            ((1 / this.mass + 1 / other.mass) * normal.dot(normal));

        // Apply impulse to both cubes
        const impulse = normal.clone().mul(impulseScalar);
        this.velocity.add(impulse.clone().mul(1 / this.mass));
        other.velocity.sub(impulse.clone().mul(1 / other.mass));

        // Prevent sticking by separating the cubes
        const overlap = (this.scale.x + other.scale.x) / 2 - this.position.distanceTo(other.position);
        if (overlap > 0) {
            const separation = normal.clone().mul(overlap / 2);
            this.position.add(separation);
            other.position.sub(separation);
        }
    }

    /**
     * Apply force to cube
     * @param {Vector.Vec3} force Force vector
     */
    applyForce(force) {
        const acceleration = force.clone().div(this.mass);
        this.acceleration.add(acceleration);
    }

    /**
     * Apply impulse (instantaneous force)
     * @param {Vector.Vec3} impulse Impulse vector
     */
    applyImpulse(impulse) {
        const deltaVelocity = impulse.clone().div(this.mass);
        this.velocity.add(deltaVelocity);
    }

    /**
     * Reset cube physics
     */
    resetPhysics() {
        this.velocity = new Vector.Vec3(0, 0, 0);
        this.acceleration = new Vector.Vec3(0, 0, 0);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Cube;
}