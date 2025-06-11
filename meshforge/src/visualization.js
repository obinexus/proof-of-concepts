import { Vector, Matrix } from "../meshforge/index.js";
import { Door } from "../meshforge/Door.js";

export class DoorVisualization {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize scene dimensions
        this.initializeViewport();
        
        // Set up camera
        this.camera = {
            position: new Vector.Vec3(0, 2, 5),
            target: new Vector.Vec3(0, 0, 0),
            up: new Vector.Vec3(0, 1, 0),
            zoom: 1
        };
        
        // Create scene matrices
        this.updateProjectionMatrix();
        this.updateViewMatrix();
        
        // Create door
        this.door = new Door({
            width: 1.0,
            height: 2.2,
            position: new Vector.Vec3(0, 0, 0),
            hasWindow: true,
            windowConfig: {
                width: 0.3,
                height: 0.8,
                position: new Vector.Vec3(0, 0.6, 0)
            }
        });
        
        // Animation state
        this.state = {
            rotation: 0,
            isDragging: false,
            previousMousePosition: { x: 0, y: 0 },
            isAnimating: false
        };
        
        // Bind methods
        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleOpenDoor = this.handleOpenDoor.bind(this);
        this.handleCloseDoor = this.handleCloseDoor.bind(this);
        this.handleResetView = this.handleResetView.bind(this);
        
        // Initialize event listeners
        this.initializeEventListeners();
    }
    
    initializeViewport() {
        this.canvas.width = window.innerWidth * 0.8;
        this.canvas.height = window.innerHeight * 0.8;
        this.viewport = {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }
    
    updateProjectionMatrix() {
        this.projectionMatrix = Matrix.Mat4.perspective(
            Math.PI / 4,
            this.viewport.width / this.viewport.height,
            0.1,
            1000
        );
    }
    
    updateViewMatrix() {
        this.viewMatrix = Matrix.Mat4.lookAt(
            this.camera.position.clone().mul(this.camera.zoom),
            this.camera.target,
            this.camera.up
        );
    }
    
    initializeEventListeners() {
        // Window events
        window.addEventListener('resize', this.handleResize);
        
        // Canvas events
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp);
        this.canvas.addEventListener('wheel', this.handleWheel);
        
        // Button events
        document.getElementById('openDoor').addEventListener('click', this.handleOpenDoor);
        document.getElementById('closeDoor').addEventListener('click', this.handleCloseDoor);
        document.getElementById('resetView').addEventListener('click', this.handleResetView);
    }
    
    // Event Handlers
    handleResize() {
        this.initializeViewport();
        this.updateProjectionMatrix();
    }
    
    handleMouseDown(e) {
        this.state.isDragging = true;
        this.state.previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };
    }
    
    handleMouseMove(e) {
        if (!this.state.isDragging) return;
        
        const deltaMove = {
            x: e.clientX - this.state.previousMousePosition.x,
            y: e.clientY - this.state.previousMousePosition.y
        };
        
        // Rotate scene
        this.state.rotation += deltaMove.x * 0.005;
        
        // Update camera height
        this.camera.position.y = Math.max(1, Math.min(5,
            this.camera.position.y - deltaMove.y * 0.05
        ));
        
        this.state.previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };
    }
    
    handleMouseUp() {
        this.state.isDragging = false;
    }
    
    handleWheel(e) {
        e.preventDefault();
        this.camera.zoom = Math.max(0.5, Math.min(2.0,
            this.camera.zoom + (e.deltaY > 0 ? 0.1 : -0.1)
        ));
    }
    
    async handleOpenDoor() {
        if (this.state.isAnimating) return;
        this.state.isAnimating = true;
        await this.door.open();
        this.state.isAnimating = false;
    }
    
    async handleCloseDoor() {
        if (this.state.isAnimating) return;
        this.state.isAnimating = true;
        await this.door.close();
        this.state.isAnimating = false;
    }
    
    handleResetView() {
        this.state.rotation = 0;
        this.camera.position = new Vector.Vec3(0, 2, 5);
        this.camera.zoom = 1;
    }
    
    // Rendering
    animate() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
        
        // Update matrices
        this.updateViewMatrix();
        
        // Render door with current matrices
        const combinedMatrix = this.projectionMatrix.multiply(this.viewMatrix);
        this.door.render(this.ctx, combinedMatrix, this.viewport);
        
        // Continue animation loop
        requestAnimationFrame(this.animate);
    }
    
    // Public methods
    start() {
        this.animate();
    }
    
    dispose() {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('wheel', this.handleWheel);
    }
}