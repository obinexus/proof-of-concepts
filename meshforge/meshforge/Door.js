import { Cube ,Vector,Matrix} from './index.js';
import { DoorWindow } from './DoorWindow.js';
import { Vertex,Polygon, BSPNode,CSG } from './BooleanOperator.js';
export class Door {
    constructor(config = {}) {
        // Door dimensions
        this.width = config.width || 1.0;
        this.height = config.height || 2.2;
        this.thickness = config.thickness || 0.05;
        this.position = config.position || new Vector.Vec3(0, 0, 0);
        
        // Panel configuration
        this.panelDepth = config.panelDepth || 0.02;
        this.panelMargin = config.panelMargin || 0.05;
        this.numPanelsVertical = config.numPanelsVertical || 2;
        this.numPanelsHorizontal = config.numPanelsHorizontal || 1;
        
        // Window configuration
        this.hasWindow = config.hasWindow !== undefined ? config.hasWindow : true;
        this.windowConfig = config.windowConfig || {
            width: 0.3,
            height: 0.8,
            position: new Vector.Vec3(0, this.height * 0.6, 0)
        };

        // Material properties
        this.color = config.color || '#4a4a4a';
        this.doorWindow = null;
        
        // Initialize components
        this.components = {
            base: null,
            panels: [],
            complete: null
        };
        
        // State
        this.openAngle = 0;
        this.isAnimating = false;
        
        // Generate the door geometry
        this.generateGeometry();
    }

    generateGeometry() {
        // Create base door cube
        const baseDoor = new Cube({
            position: this.position,
            scale: new Vector.Vec3(this.width, this.height, this.thickness)
        });
        
        // Convert to CSG for boolean operations
        let doorCSG = CSG.fromMesh(baseDoor);
        
        // Add decorative panels
        const panelWidth = (this.width - (this.panelMargin * (this.numPanelsHorizontal + 1))) / this.numPanelsHorizontal;
        const panelHeight = (this.height - (this.panelMargin * (this.numPanelsVertical + 1))) / this.numPanelsVertical;
        
        for (let i = 0; i < this.numPanelsVertical; i++) {
            for (let j = 0; j < this.numPanelsHorizontal; j++) {
                const panelX = -this.width/2 + this.panelMargin + j * (panelWidth + this.panelMargin) + panelWidth/2;
                const panelY = -this.height/2 + this.panelMargin + i * (panelHeight + this.panelMargin) + panelHeight/2;
                
                const panel = new Cube({
                    position: new Vector.Vec3(
                        this.position.x + panelX,
                        this.position.y + panelY,
                        this.position.z
                    ),
                    scale: new Vector.Vec3(panelWidth, panelHeight, this.panelDepth)
                });
                
                const panelCSG = CSG.fromMesh(panel);
                doorCSG = doorCSG.union(panelCSG);
                this.components.panels.push(panelCSG);
            }
        }
        
        // Add window if configured
        if (this.hasWindow) {
            this.doorWindow = new DoorWindow({
                ...this.windowConfig,
                position: new Vector.Vec3(
                    this.position.x,
                    this.position.y + this.windowConfig.position.y,
                    this.position.z
                )
            });
            
            // Cut window hole in door
            const windowCutout = new Cube({
                position: this.doorWindow.position,
                scale: new Vector.Vec3(
                    this.doorWindow.width,
                    this.doorWindow.height,
                    this.thickness * 2
                )
            });
            
            const windowCutoutCSG = CSG.fromMesh(windowCutout);
            doorCSG = doorCSG.subtract(windowCutoutCSG);
            
            // Add window frame and glass
            doorCSG = doorCSG.union(this.doorWindow.components.complete);
        }
        
        this.components.complete = doorCSG;
    }

    transform(matrix) {
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

        if (this.doorWindow) {
            this.doorWindow.transform(matrix);
        }
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
        this.openAngle = (axis === 'y') ? angle : this.openAngle;
    }

    translate(vector) {
        const translationMatrix = Matrix.Mat4.translation(vector.x, vector.y, vector.z);
        this.transform(translationMatrix);
    }

    render(ctx, projectionMatrix, viewport, options = {}) {
        const renderComponent = (component, style) => {
            if (!component || !component.vertices) return;

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

        // Render door base and panels
        renderComponent(this.components.complete, {
            strokeStyle: '#333333',
            fillStyle: this.color
        });

        // Render window if present
        if (this.doorWindow) {
            this.doorWindow.render(ctx, projectionMatrix, viewport, options);
        }
    }

    // Animation methods
    async open(targetAngle = Math.PI / 2, duration = 1000) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const startAngle = this.openAngle;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easing function for smooth animation
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            this.openAngle = startAngle + (targetAngle - startAngle) * easeProgress;
            this.rotate('y', this.openAngle);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
            }
        };

        animate();
    }

    async close(duration = 1000) {
        return this.open(0, duration);
    }
}
