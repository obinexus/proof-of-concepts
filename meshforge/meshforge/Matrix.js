import { Vector } from './Vector.js';
/* A comprehensive matrix mathematics library supporting 2D, 3D, and 4D operations
 * @module Matrix
 */
export const Matrix = (function() {
    'use strict';

    /**
     * Matrix class supporting arbitrary dimensions
     */
    class Mat {
        /**
         * Create a new matrix
         * @param {number} rows Number of rows
         * @param {number} cols Number of columns
         * @param {Array<number>} [data] Initial data (column-major order)
         */
        constructor(rows, cols, data = null) {
            this.rows = rows;
            this.cols = cols;
            this.data = new Float64Array(rows * cols);
            
            if (data) {
                if (data.length !== rows * cols) {
                    throw new Error('Data length mismatch');
                }
                this.data.set(data);
            }
        }

        /**
         * Get element at position (i,j)
         * @param {number} i Row index
         * @param {number} j Column index
         * @returns {number}
         */
        get(row, col) {
            return this.data[col * 4 + row];
        }

        /**
         * Set element at position (i,j)
         * @param {number} i Row index
         * @param {number} j Column index
         * @param {number} value Value to set
         */
        set(i, j, value) {
            this.data[j * this.rows + i] = value;
        }

        /**
         * Create identity matrix of given size
         * @param {number} size Matrix size
         * @returns {Mat}
         */
        static identity(size) {
            const mat = new Mat(size, size);
            for (let i = 0; i < size; i++) {
                mat.set(i, i, 1);
            }
            return mat;
        }

        /**
         * Matrix multiplication
         * @param {Mat} other Matrix to multiply with
         * @returns {Mat} Result matrix
         */
        multiply(other) {
            if (this.cols !== other.rows) {
                throw new Error('Matrix dimensions incompatible for multiplication');
            }

            const result = new Mat(this.rows, other.cols);
            
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < other.cols; j++) {
                    let sum = 0;
                    for (let k = 0; k < this.cols; k++) {
                        sum += this.get(i, k) * other.get(k, j);
                    }
                    result.set(i, j, sum);
                }
            }

            return result;
        }

        /**
         * Transpose matrix
         * @returns {Mat} Transposed matrix
         */
        transpose() {
            const result = new Mat(this.cols, this.rows);
            
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    result.set(j, i, this.get(i, j));
                }
            }

            return result;
        }

        /**
         * Calculate determinant (only for square matrices)
         * @returns {number} Matrix determinant
         */
        determinant() {
            if (this.rows !== this.cols) {
                throw new Error('Determinant only defined for square matrices');
            }

            if (this.rows === 2) {
                return this.get(0, 0) * this.get(1, 1) - this.get(0, 1) * this.get(1, 0);
            }

            let det = 0;
            const n = this.rows;

            if (n === 1) {
                return this.get(0, 0);
            }

            for (let j = 0; j < n; j++) {
                det += Math.pow(-1, j) * this.get(0, j) * this.minor(0, j).determinant();
            }

            return det;
        }

        /**
         * Get matrix minor by removing row i and column j
         * @param {number} i Row to remove
         * @param {number} j Column to remove
         * @returns {Mat} Minor matrix
         */
        minor(i, j) {
            const result = new Mat(this.rows - 1, this.cols - 1);
            let r = 0, c = 0;

            for (let row = 0; row < this.rows; row++) {
                if (row === i) continue;
                c = 0;
                for (let col = 0; col < this.cols; col++) {
                    if (col === j) continue;
                    result.set(r, c, this.get(row, col));
                    c++;
                }
                r++;
            }

            return result;
        }

        /**
         * Calculate inverse matrix (only for square matrices)
         * @returns {Mat} Inverse matrix
         */
        inverse() {
            if (this.rows !== this.cols) {
                throw new Error('Inverse only defined for square matrices');
            }

            const det = this.determinant();
            if (Math.abs(det) < 1e-10) {
                throw new Error('Matrix is not invertible');
            }

            const n = this.rows;
            const result = new Mat(n, n);

            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    const sign = Math.pow(-1, i + j);
                    const minor = this.minor(j, i);
                    result.set(i, j, sign * minor.determinant() / det);
                }
            }

            return result;
        }

        /**
         * Scale matrix by scalar value
         * @param {number} scalar Scalar value
         * @returns {Mat} Scaled matrix
         */
        scale(scalar) {
            const result = new Mat(this.rows, this.cols);
            for (let i = 0; i < this.data.length; i++) {
                result.data[i] = this.data[i] * scalar;
            }
            return result;
        }

        /**
         * Add matrix
         * @param {Mat} other Matrix to add
         * @returns {Mat} Result matrix
         */
        add(other) {
            if (this.rows !== other.rows || this.cols !== other.cols) {
                throw new Error('Matrix dimensions must match for addition');
            }

            const result = new Mat(this.rows, this.cols);
            for (let i = 0; i < this.data.length; i++) {
                result.data[i] = this.data[i] + other.data[i];
            }
            return result;
        }

        /**
         * Subtract matrix
         * @param {Mat} other Matrix to subtract
         * @returns {Mat} Result matrix
         */
        subtract(other) {
            if (this.rows !== other.rows || this.cols !== other.cols) {
                throw new Error('Matrix dimensions must match for subtraction');
            }

            const result = new Mat(this.rows, this.cols);
            for (let i = 0; i < this.data.length; i++) {
                result.data[i] = this.data[i] - other.data[i];
            }
            return result;
        }

        /**
         * Clone matrix
         * @returns {Mat} Cloned matrix
         */
        clone() {
            return new Mat(this.rows, this.cols, this.data);
        }

        /**
         * Convert matrix to array
         * @returns {Array<number>} Array representation
         */
        toArray() {
            return Array.from(this.data);
        }

        /**
         * Convert to string representation
         * @returns {string} String representation
         */
        toString() {
            let str = '';
            for (let i = 0; i < this.rows; i++) {
                str += '|';
                for (let j = 0; j < this.cols; j++) {
                    str += ` ${this.get(i, j).toFixed(4)} `;
                }
                str += '|\n';
            }
            return str;
        }
    }

    /**
     * 4x4 Matrix class optimized for 3D transformations
     */
    class Mat4 extends Mat {
        constructor(data = null) {
            super(4, 4, data);
        }

        /**
         * Create identity matrix
         * @returns {Mat4}
         */
        static identity() {
            return new Mat4([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);
        }

        /**
         * Create translation matrix
         * @param {number} x X translation
         * @param {number} y Y translation
         * @param {number} z Z translation
         * @returns {Mat4}
         */
        static translation(x, y, z) {
            return new Mat4([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                x, y, z, 1
            ]);
        }

        /**
         * Create scale matrix
         * @param {number} x X scale
         * @param {number} y Y scale
         * @param {number} z Z scale
         * @returns {Mat4}
         */
        static scale(x, y, z) {
            return new Mat4([
                x, 0, 0, 0,
                0, y, 0, 0,
                0, 0, z, 0,
                0, 0, 0, 1
            ]);
        }

        /**
         * Create rotation matrix around X axis
         * @param {number} angle Rotation angle in radians
         * @returns {Mat4}
         */
        static rotationX(angle) {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return new Mat4([
                1, 0,  0, 0,
                0, c, -s, 0,
                0, s,  c, 0,
                0, 0,  0, 1
            ]);
        }

        /**
         * Create rotation matrix around Y axis
         * @param {number} angle Rotation angle in radians
         * @returns {Mat4}
         */
        static rotationY(angle) {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return new Mat4([
                 c, 0, s, 0,
                 0, 1, 0, 0,
                -s, 0, c, 0,
                 0, 0, 0, 1
            ]);
        }

        /**
         * Create rotation matrix around Z axis
         * @param {number} angle Rotation angle in radians
         * @returns {Mat4}
         */
        static rotationZ(angle) {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return new Mat4([
                c, -s, 0, 0,
                s,  c, 0, 0,
                0,  0, 1, 0,
                0,  0, 0, 1
            ]);
        }

        /**
         * Create perspective projection matrix
         * @param {number} fov Field of view in radians
         * @param {number} aspect Aspect ratio
         * @param {number} near Near clipping plane
         * @param {number} far Far clipping plane
         * @returns {Mat4}
         */
        static perspective(fov, aspect, near, far) {
            const f = 1.0 / Math.tan(fov / 2);
            const rangeInv = 1 / (near - far);

            return new Mat4([
                f / aspect, 0, 0, 0,
                0, f, 0, 0,
                0, 0, (near + far) * rangeInv, -1,
                0, 0, near * far * rangeInv * 2, 0
            ]);
        }

        /**
         * Create orthographic projection matrix
         * @param {number} left Left plane
         * @param {number} right Right plane
         * @param {number} bottom Bottom plane
         * @param {number} top Top plane
         * @param {number} near Near plane
         * @param {number} far Far plane
         * @returns {Mat4}
         */
        static orthographic(left, right, bottom, top, near, far) {
            const w = right - left;
            const h = top - bottom;
            const d = far - near;

            return new Mat4([
                2 / w, 0, 0, 0,
                0, 2 / h, 0, 0,
                0, 0, -2 / d, 0,
                -(right + left) / w, -(top + bottom) / h, -(far + near) / d, 1
            ]);
        } 
         static lookAt(eye, target, up) {
            // Calculate z axis (forward)
            const z = eye.clone();
            z.sub(target).normalize();
            
            // Calculate x axis (right)
            const x = up.clone();
            x.cross(z).normalize();
            
            // Calculate y axis (up)
            const y = z.clone();
            y.cross(x);

            // Construct view matrix
            return new Mat4([
                x.x, y.x, z.x, 0,
                x.y, y.y, z.y, 0,
                x.z, y.z, z.z, 0,
                -x.dot(eye), -y.dot(eye), -z.dot(eye), 1
            ]);
        }
    }

    return {
        Mat,
        Mat4
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Matrix;
}