import { Cube ,Vector,Matrix} from './index.js';

export class Cone {
    /**
     * Create a new cone
     * @param {Object} config Configuration object
     * @param {Vector.Vec3} config.position Initial position
     * @param {number} config.radius Base radius
     * @param {number} config.height Cone height
     * @param {number} config.segments Number of segments around base
     */
    constructor(config = {}) {
        // Core properties
        this.position = config.position || new Vector.Vec3(0, 0, 0);
        this.radius = config.radius || 1;
        this.height = config.height || 2;
        this.segments = config.segments || 32;
        
        // Rendering properties
        this.color = config.color || '#ffffff';
        this.wireframe = config.wireframe || false;

        // Initialize geometry
        this.vertices = [];
        this.faces = [];
        this.normals = [];
        this.generateGeometry();

        // Create transformation matrix
        this.modelMatrix = Matrix.Mat4.identity();
        this.updateModelMatrix();
    }

    /**
     * Generate cone geometry
     */
    generateGeometry() {
        // Clear existing geometry
        this.vertices = [];
        this.faces = [];
        this.normals = [];

        // Add apex vertex
        const apex = new Vector.Vec3(0, this.height, 0);
        this.vertices.push(apex);

        // Generate base vertices
        for (let i = 0; i < this.segments; i++) {
            const theta = (i * 2 * Math.PI) / this.segments;
            const x = this.radius * Math.cos(theta);
            const z = this.radius * Math.sin(theta);
            this.vertices.push(new Vector.Vec3(x, 0, z));
        }

        // Generate faces
        // Base center vertex is at vertices.length
        this.vertices.push(new Vector.Vec3(0, 0, 0));
        const baseCenter = this.vertices.length - 1;

        // Create side faces
        for (let i = 1; i <= this.segments; i++) {
            const current = i;
            const next = i % this.segments + 1;
            
            // Side face
            this.faces.push([0, current, next]);
            
            // Calculate normal for the side face
            const v1 = this.vertices[current];
            const v2 = this.vertices[next];
            const v3 = this.vertices[0]; // apex
            
            const edge1 = v2.clone().sub(v1);
            const edge2 = v3.clone().sub(v1);
            const normal = edge1.cross(edge2).normalize();
            
            this.normals.push(normal);
            
            // Base triangle
            this.faces.push([baseCenter, next, current]);
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
     * Render cone to canvas context
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

        // Draw faces
        ctx.beginPath();
        ctx.strokeStyle = this.wireframe ? '#ffffff' : this.color;
        ctx.fillStyle = this.wireframe ? 'transparent' : this.color;

        // Draw each face
        for (const face of this.faces) {
            ctx.moveTo(
                projectedVertices[face[0]].x,
                projectedVertices[face[0]].y
            );

            for (let i = 1; i < face.length; i++) {
                ctx.lineTo(
                    projectedVertices[face[i]].x,
                    projectedVertices[face[i]].y
                );
            }

            ctx.closePath();
            
            if (this.wireframe) {
                ctx.stroke();
            } else {
                ctx.fill();
            }
        }
    }

    /**
     * Rotate the cone around the X axis
     * @param {number} angle Rotation angle in radians
     */
    rotateX(angle) {
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].rotateX(angle);
        }
    }

    /**
     * Rotate the cone around the Y axis
     * @param {number} angle Rotation angle in radians
     */
    rotateY(angle) {
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].rotateY(angle);
        }
    }

    /**
     * Rotate the cone around the Z axis
     * @param {number} angle Rotation angle in radians
     */
    rotateZ(angle) {
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].rotateZ(angle);
        }
    }
}

// // Example usage:
// const canvas = document.getElementById('canvas');
// const ctx = canvas.getContext('2d');

// // Set canvas size
// canvas.width = 800;
// canvas.height = 600;

// // Create viewport
// const viewport = {
//     width: canvas.width,
//     height: canvas.height
// };

// // Create projection matrix
// const projectionMatrix = Matrix.Mat4.perspective(
//     Math.PI / 4,
//     viewport.width / viewport.height,
//     0.1,
//     1000
// );

// // Create cone
// const cone = new Cone({
//     position: new Vector.Vec3(canvas.width / 2, canvas.height / 2, 0),
//     radius: 100,
//     height: 200,
//     segments: 32,
//     wireframe: true
// });

// // Animation loop
// function animate() {
//     // Clear canvas
//     ctx.clearRect(0, 0, canvas.width, canvas.height);
    
//     // Rotate cone
//     cone.rotateY(0.02);
//     cone.rotateX(0.01);
    
//     // Render cone
//     cone.render(ctx, projectionMatrix, viewport);
    
//     // Request next frame
//     requestAnimationFrame(animate);
// }

// Start animation
// animate();