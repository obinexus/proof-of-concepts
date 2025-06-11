import { Cube } from './Cube.js';
import { Vector } from './Vector.js';
import { Matrix } from './Matrix.js';
import { Vertex,Polygon, BSPNode,CSG } from './BooleanOperator.js';

// Description: DoorWindow class for creating 3D door and window objects.
export class DoorWindow {
    constructor(config = {}) {
        // Default configuration
        this.width = config.width || 0.3;
        this.height = config.height || 0.8;
        this.depth = config.depth || 0.05;
        this.position = config.position || new Vector.Vec3(0, 0, 0);
        this.frameThickness = config.frameThickness || 0.04;
        this.glassThickness = config.glassThickness || 0.01;
        
        // Initialize components
        this.components = {
            frame: null,
            glass: null,
            complete: null
        };
        
        // Generate geometry
        this.generateGeometry();
    }

    generateGeometry() {
        // Create outer frame cube
        const outerFrame = new Cube({
            position: this.position,
            scale: new Vector.Vec3(this.width, this.height, this.depth)
        });

        // Create inner cutout cube (slightly smaller)
        const innerCutout = new Cube({
            position: this.position,
            scale: new Vector.Vec3(
                this.width - this.frameThickness * 2,
                this.height - this.frameThickness * 2,
                this.depth + 0.02 // Slightly larger for clean boolean operation
            )
        });

        // Create glass panel
        const glassPanel = new Cube({
            position: this.position,
            scale: new Vector.Vec3(
                this.width - this.frameThickness * 2,
                this.height - this.frameThickness * 2,
                this.glassThickness
            )
        });

        // Convert to CSG objects for boolean operations
        const frameCSG = CSG.fromMesh(outerFrame);
        const cutoutCSG = CSG.fromMesh(innerCutout);
        const glassCSG = CSG.fromMesh(glassPanel);

        // Create frame by subtracting inner cutout from outer frame
        this.components.frame = frameCSG.subtract(cutoutCSG);
        this.components.glass = glassCSG;

        // Combine frame and glass
        this.components.complete = frameCSG.subtract(cutoutCSG).union(glassCSG);
    }

    transform(matrix) {
        // Apply transformation matrix to all vertices
        Object.values(this.components).forEach(component => {
            if (component && component.vertices) {
                component.vertices = component.vertices.map(vertex => {
                    const transformed = matrix.multiply(new Matrix.Mat4([
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
                });
            }
        });
    }

    rotate(axis, angle) {
        let rotationMatrix;
        switch (axis.toLowerCase()) {
            case 'x':
                rotationMatrix = Matrix.Mat4.rotationX(angle);
                break;
            case 'y':
                rotationMatrix = Matrix.Mat4.rotationY(angle);
                break;
            case 'z':
                rotationMatrix = Matrix.Mat4.rotationZ(angle);
                break;
            default:
                throw new Error('Invalid rotation axis');
        }
        this.transform(rotationMatrix);
    }

    translate(vector) {
        const translationMatrix = Matrix.Mat4.translation(vector.x, vector.y, vector.z);
        this.transform(translationMatrix);
    }

    render(ctx, projectionMatrix, viewport, options = {}) {
        const renderComponent = (component, style) => {
            if (!component || !component.vertices) return;

            // Transform vertices to screen space
            const projectedVertices = component.vertices.map(vertex => {
                const projected = projectionMatrix.multiply(new Matrix.Mat4([
                    vertex.x, vertex.y, vertex.z, 1,
                    0, 0, 0, 0,
                    0, 0, 0, 0,
                    0, 0, 0, 0
                ]));

                const w = projected.get(3, 0);
                return new Vector.Vec2(
                    (projected.get(0, 0) / w + 1) * viewport.width / 2,
                    (-projected.get(1, 0) / w + 1) * viewport.height / 2
                );
            });

            // Draw faces
            ctx.beginPath();
            component.faces.forEach(face => {
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
            });

            Object.assign(ctx, style);
            if (options.wireframe) {
                ctx.stroke();
            } else {
                ctx.fill();
            }
        };

        // Render frame
        renderComponent(this.components.frame, {
            strokeStyle: '#333333',
            fillStyle: '#4a4a4a'
        });

        // Render glass with transparency
        renderComponent(this.components.glass, {
            strokeStyle: '#cccccc',
            fillStyle: 'rgba(200, 220, 255, 0.3)'
        });
    }
    
}

// // Example usage:
// const canvas = document.getElementById('canvas');
// const ctx = canvas.getContext('2d');

// const viewport = {
//     width: canvas.width,
//     height: canvas.height
// };

// const projectionMatrix = Matrix.Mat4.perspective(
//     Math.PI / 4,
//     viewport.width / viewport.height,
//     0.1,
//     1000
// );

// const doorWindow = new DoorWindow({
//     width: 0.3,
//     height: 0.8,
//     position: new Vector.Vec3(0, 0, -2)
// });

// function animate() {
//     ctx.clearRect(0, 0, viewport.width, viewport.height);
    
//     doorWindow.rotate('y', 0.01);
//     doorWindow.render(ctx, projectionMatrix, viewport, { wireframe: true });
    
//     requestAnimationFrame(animate);
// }

// animate();