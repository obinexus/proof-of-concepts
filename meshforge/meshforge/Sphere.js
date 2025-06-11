import * as Vector from './Vector.js';
import * as Matrix from './Matrix.js';

/**
 * A comprehensive 3D Sphere implementation using Vector and Matrix libraries
 * @module Sphere
 */
export class Sphere {
    /**
     * Create a new sphere
     * @param {Object} config Configuration object
     * @param {Vector.Vec3} config.position Initial position
     * @param {number} config.radius Sphere radius
     * @param {number} config.detail Level of detail (number of segments)
     * @param {string} config.texture Path to texture image (optional)
     */
    constructor(config = {}) {
        // Core properties
        this.position = config.position || new Vector.Vec3(0, 0, 0);
        this.radius = config.radius || 1;
        this.detail = config.detail || 32;
        
        // Physics properties
        this.velocity = new Vector.Vec3(0, 0, 0);
        this.acceleration = new Vector.Vec3(0, 0, 0);
        this.mass = config.mass || 1;
        this.friction = config.friction || 0.1;
        this.elasticity = config.elasticity || 0.8;

        // Rendering properties
        this.texture = config.texture || null;
        this.color = config.color || '#ffffff';
        this.wireframe = config.wireframe || false;

        // Initialize geometry
        this.vertices = [];
        this.faces = [];
        this.uvs = [];
        this.normals = [];
        this.generateGeometry();

        // Create transformation matrix
        this.modelMatrix = Matrix.Mat4.identity();
        this.updateModelMatrix();
    }

    /**
     * Generate sphere geometry
     */
    generateGeometry() {
        // Clear existing geometry
        this.vertices = [];
        this.faces = [];
        this.uvs = [];
        this.normals = [];

        // Generate vertices
        for (let lat = 0; lat <= this.detail; lat++) {
            const theta = (lat * Math.PI) / this.detail;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let long = 0; long <= this.detail; long++) {
                const phi = (long * 2 * Math.PI) / this.detail;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                // Calculate vertex position
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;

                // Add vertex
                const vertex = new Vector.Vec3(
                    x * this.radius,
                    y * this.radius,
                    z * this.radius
                );
                this.vertices.push(vertex);

                // Add normal (normalized vertex position for sphere)
                this.normals.push(new Vector.Vec3(x, y, z));

                // Add UV coordinate
                this.uvs.push([long / this.detail, lat / this.detail]);
            }
        }

        // Generate faces
        for (let lat = 0; lat < this.detail; lat++) {
            for (let long = 0; long < this.detail; long++) {
                const first = lat * (this.detail + 1) + long;
                const second = first + this.detail + 1;

                // Create two triangles for each quad
                this.faces.push({
                    vertices: [first, second, first + 1],
                    uvs: [
                        this.uvs[first],
                        this.uvs[second],
                        this.uvs[first + 1]
                    ],
                    normal: this.normals[first]
                });

                this.faces.push({
                    vertices: [second, second + 1, first + 1],
                    uvs: [
                        this.uvs[second],
                        this.uvs[second + 1],
                        this.uvs[first + 1]
                    ],
                    normal: this.normals[second]
                });
            }
        }
    }

    /**
     * Update model matrix based on position
     */
    updateModelMatrix() {
        this.modelMatrix = Matrix.Mat4.translation(
            this.position.x,
            this.position.y,
            this.position.z
        );
    }

    /**
     * Transform a vertex by the model matrix
     * @param {Vector.Vec3} vertex Vertex to transform
     * @returns {Vector.Vec3} Transformed vertex
     */
    transformVertex(vertex) {
        const transformed = this.modelMatrix.multiply(new Matrix.Mat4([
            vertex.x, vertex.y, vertex.z, 1,
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
     * Update sphere physics
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
     * Render sphere to canvas context
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
            .map(face => ({
                ...face,
                depth: this.calculateFaceDepth(transformedVertices, face.vertices)
            }))
            .sort((a, b) => b.depth - a.depth);

        // Render faces
        sortedFaces.forEach(face => {
            // Back-face culling
            const viewVector = transformedVertices[face.vertices[0]].clone().normalize();
            if (face.normal.dot(viewVector) < 0) {
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
            this.applyTextureToFace(ctx, projectedVertices, face);
        } else {
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        if (this.wireframe) {
            ctx.strokeStyle = '#000';
            ctx.stroke();
        }
    }

    /**
     * Check collision with another sphere
     * @param {Sphere} other Other sphere to check collision with
     * @returns {boolean} True if colliding
     */
    isColliding(other) {
        const distance = this.position.distanceTo(other.position);
        return distance < (this.radius + other.radius);
    }

    /**
     * Handle collision response
     * @param {Sphere} other Other sphere involved in collision
     */
    resolveCollision(other) {
        // Calculate collision normal
        const normal = this.position.clone().sub(other.position).normalize();

        // Calculate relative velocity
        const relativeVelocity = this.velocity.clone().sub(other.velocity);

        // Calculate impulse scalar
        const impulseScalar = -(1 + this.elasticity) * relativeVelocity.dot(normal) /
            ((1 / this.mass + 1 / other.mass) * normal.dot(normal));

        // Apply impulse to both spheres
        const impulse = normal.clone().mul(impulseScalar);
        this.velocity.add(impulse.clone().mul(1 / this.mass));
        other.velocity.sub(impulse.clone().mul(1 / other.mass));

        // Prevent sticking by separating the spheres
        const overlap = (this.radius + other.radius) - this.position.distanceTo(other.position);
        if (overlap > 0) {
            const separation = normal.clone().mul(overlap / 2);
            this.position.add(separation);
            other.position.sub(separation);
        }
    }

    /**
     * Apply force to sphere
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
     * Reset sphere physics
     */
    resetPhysics() {
        this.velocity = new Vector.Vec3(0, 0, 0);
        this.acceleration = new Vector.Vec3(0, 0, 0);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sphere;
}