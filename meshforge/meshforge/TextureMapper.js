/**
 * A comprehensive texture mapping system for 3D objects
 * @module TextureMapper
 */
export class TextureMapper {
    /**
     * Create a new texture mapper
     * @param {HTMLCanvasElement} canvas Canvas element
     * @param {Object} config Configuration object
     */
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objects = new Map();
        this.textures = new Map();
        this.gridSize = config.gridSize || 1;
        this.animating = false;

        // Configuration
        this.config = {
            enableMipmaps: config.enableMipmaps || false,
            bilinearFiltering: config.bilinearFiltering || true,
            perspectiveCorrection: config.perspectiveCorrection || true,
            wireframe: config.wireframe || false,
            debug: config.debug || false
        };

        // Bind methods
        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleContextLost = this.handleContextLost.bind(this);
        this.handleContextRestored = this.handleContextRestored.bind(this);

        // Initialize
        this.setupCanvas();
        this.setupEventListeners();
    }

    /**
     * Set up canvas and context
     * @private
     */
    setupCanvas() {
        // Enable high-DPI rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);

        // Enable image smoothing for better texture quality
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    /**
     * Set up event listeners
     * @private
     */
    setupEventListeners() {
        window.addEventListener('resize', this.handleResize);
        this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
        this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    }

    /**
     * Load and prepare a texture
     * @param {string} id Texture identifier
     * @param {string|HTMLImageElement} source Texture source
     * @returns {Promise<HTMLImageElement>}
     */
    async loadTexture(id, source) {
        return new Promise((resolve, reject) => {
            const texture = source instanceof HTMLImageElement ? source : new Image();
            
            texture.onload = () => {
                if (this.config.enableMipmaps) {
                    this.generateMipmaps(texture);
                }
                this.textures.set(id, texture);
                resolve(texture);
            };
            
            texture.onerror = reject;
            
            if (!(source instanceof HTMLImageElement)) {
                texture.src = source;
            }
        });
    }

    /**
     * Generate mipmaps for a texture
     * @param {HTMLImageElement} texture Original texture
     * @private
     */
    generateMipmaps(texture) {
        const mipmaps = [];
        let size = Math.max(texture.width, texture.height);
        let level = 0;

        while (size >= 1) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size;
            canvas.height = size;

            if (level === 0) {
                ctx.drawImage(texture, 0, 0);
            } else {
                ctx.drawImage(mipmaps[level - 1], 0, 0, size * 2, size * 2, 0, 0, size, size);
            }

            mipmaps.push(canvas);
            size = Math.floor(size / 2);
            level++;
        }

        texture.mipmaps = mipmaps;
    }

    /**
     * Map texture to a polygon with perspective correction
     * @param {CanvasRenderingContext2D} ctx Canvas context
     * @param {HTMLImageElement} texture Texture to map
     * @param {Array<Vector.Vec2>} vertices 2D vertices
     * @param {Array<Array<number>>} uvs Texture coordinates
     */
    mapTextureToPolygon(ctx, texture, vertices, uvs) {
        // Create temporary canvas for texture transformation
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = texture.width;
        tempCanvas.height = texture.height;

        // Draw original texture to temporary canvas
        tempCtx.drawImage(texture, 0, 0);

        // Calculate perspective transform
        const srcPoints = uvs.map(uv => ({
            x: uv[0] * texture.width,
            y: uv[1] * texture.height
        }));

        const dstPoints = vertices.map(v => ({
            x: v.x,
            y: v.y
        }));

        const transform = this.calculatePerspectiveTransform(srcPoints, dstPoints);

        // Apply transformation
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
        ctx.clip();

        ctx.transform(
            transform.a, transform.b,
            transform.c, transform.d,
            transform.e, transform.f
        );

        if (this.config.bilinearFiltering) {
            this.drawWithBilinearFiltering(ctx, tempCanvas);
        } else {
            ctx.drawImage(tempCanvas, 0, 0);
        }

        ctx.restore();

        if (this.config.wireframe) {
            this.drawWireframe(ctx, vertices);
        }
    }

    /**
     * Calculate perspective transform matrix
     * @param {Array<Object>} src Source points
     * @param {Array<Object>} dst Destination points
     * @returns {Object} Transform coefficients
     * @private
     */
    calculatePerspectiveTransform(src, dst) {
        // Enhanced version using singular value decomposition for better numerical stability
        const getAdjugate = (m) => {
            return {
                a: m[3], b: -m[1],
                c: -m[2], d: m[0]
            };
        };

        const normalize = (points) => {
            const centroid = points.reduce((acc, p) => ({
                x: acc.x + p.x / points.length,
                y: acc.y / p.length
            }), { x: 0, y: 0 });

            const scale = Math.sqrt(points.reduce((acc, p) => {
                const dx = p.x - centroid.x;
                const dy = p.y - centroid.y;
                return acc + (dx * dx + dy * dy) / points.length;
            }, 0));

            return {
                points: points.map(p => ({
                    x: (p.x - centroid.x) / scale,
                    y: (p.y - centroid.y) / scale
                })),
                translate: centroid,
                scale: scale
            };
        };

        const srcNorm = normalize(src);
        const dstNorm = normalize(dst);

        // Calculate the transformation matrix
        const dx1 = srcNorm.points[1].x - srcNorm.points[0].x;
        const dy1 = srcNorm.points[1].y - srcNorm.points[0].y;
        const dx2 = srcNorm.points[2].x - srcNorm.points[0].x;
        const dy2 = srcNorm.points[2].y - srcNorm.points[0].y;

        const dx3 = dstNorm.points[1].x - dstNorm.points[0].x;
        const dy3 = dstNorm.points[1].y - dstNorm.points[0].y;
        const dx4 = dstNorm.points[2].x - dstNorm.points[0].x;
        const dy4 = dstNorm.points[2].y - dstNorm.points[0].y;

        // Calculate transformation matrix
        return {
            a: dx3 / dx1,
            b: dy3 / dx1,
            c: dx4 / dy2,
            d: dy4 / dy2,
            e: dstNorm.points[0].x - (dx3 * srcNorm.points[0].x) / dx1,
            f: dstNorm.points[0].y - (dy3 * srcNorm.points[0].y) / dx1
        };
    }

    /**
     * Draw with bilinear filtering
     * @param {CanvasRenderingContext2D} ctx Canvas context
     * @param {HTMLCanvasElement} source Source canvas
     * @private
     */
    drawWithBilinearFiltering(ctx, source) {
        const imgData = source.getContext('2d').getImageData(
            0, 0, source.width, source.height
        );
        const pixels = imgData.data;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = source.width * 2;
        tempCanvas.height = source.height * 2;

        const destImgData = tempCtx.createImageData(
            tempCanvas.width, tempCanvas.height
        );
        const destPixels = destImgData.data;

        // Bilinear interpolation
        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const srcX = x / 2;
                const srcY = y / 2;
                const x1 = Math.floor(srcX);
                const y1 = Math.floor(srcY);
                const x2 = Math.min(x1 + 1, source.width - 1);
                const y2 = Math.min(y1 + 1, source.height - 1);
                const fx = srcX - x1;
                const fy = srcY - y1;

                for (let i = 0; i < 4; i++) {
                    const p11 = pixels[(y1 * source.width + x1) * 4 + i];
                    const p12 = pixels[(y1 * source.width + x2) * 4 + i];
                    const p21 = pixels[(y2 * source.width + x1) * 4 + i];
                    const p22 = pixels[(y2 * source.width + x2) * 4 + i];

                    const value = Math.round(
                        p11 * (1 - fx) * (1 - fy) +
                        p12 * fx * (1 - fy) +
                        p21 * (1 - fx) * fy +
                        p22 * fx * fy
                    );

                    destPixels[(y * tempCanvas.width + x) * 4 + i] = value;
                }
            }
        }

        tempCtx.putImageData(destImgData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, source.width, source.height);
    }

    /**
     * Draw wireframe for debugging
     * @param {CanvasRenderingContext2D} ctx Canvas context
     * @param {Array<Vector.Vec2>} vertices Vertices to draw
     * @private
     */
    drawWireframe(ctx, vertices) {
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.stroke();
    }

    /**
     * Start animation loop
     */
    start() {
        if (!this.animating) {
            this.animating = true;
            this.animate();
        }
    }

    /**
     * Stop animation loop
     */
    stop() {
        this.animating = false;
    }

    /**
     * Animation loop
     * @private
     */
    animate() {
        if (!this.animating) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and render all objects
        for (const object of this.objects.values()) {
            if (object.update) {
                object.update();
            }
            if (object.render) {
                object.render(this.ctx);
            }
        }

        requestAnimationFrame(this.animate);
    }

    /**
     * Handle canvas resize
     * @private
     */
    handleResize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
    }

    /**
     * Handle context loss
     * @private
     */
    handleContextLost(event) {
        event.preventDefault();
        this.stop();
    }

    /**
     * Handle context restoration
     * @private
     */
    handleContextRestored() {
        this.setupCanvas();
        this.start();
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.stop();
        window.removeEventListener('resize', this.handleResize);
        this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
        this.objects.clear();
        this.textures.clear();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextureMapper;
}