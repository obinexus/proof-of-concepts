/**
 * A comprehensive vector mathematics library supporting 2D and 3D operations
 * @module Vector
 */
export const Vector = (function() {
    'use strict';

    /**
     * 2D Vector class
     */
    class Vec2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }

        // Static properties
        static get ZERO() { return new Vec2(0, 0); }
        static get ONE() { return new Vec2(1, 1); }
        static get I() { return new Vec2(1, 0); }
        static get J() { return new Vec2(0, 1); }

        // Static methods
        static fromAngle(angle) {
            return new Vec2(Math.cos(angle), Math.sin(angle));
        }

        static lerp(v1, v2, t) {
            return new Vec2(
                v1.x + (v2.x - v1.x) * t,
                v1.y + (v2.y - v1.y) * t
            );
        }

        // Instance methods
        add(v) {
            if (v instanceof Vec2) {
                this.x += v.x;
                this.y += v.y;
            } else {
                this.x += v;
                this.y += v;
            }
            return this;
        }

        sub(v) {
            if (v instanceof Vec2) {
                this.x -= v.x;
                this.y -= v.y;
            } else {
                this.x -= v;
                this.y -= v;
            }
            return this;
        }

        mul(v) {
            if (v instanceof Vec2) {
                this.x *= v.x;
                this.y *= v.y;
            } else {
                this.x *= v;
                this.y *= v;
            }
            return this;
        }

        div(v) {
            if (v instanceof Vec2) {
                if (v.x !== 0) this.x /= v.x;
                if (v.y !== 0) this.y /= v.y;
            } else {
                if (v !== 0) {
                    this.x /= v;
                    this.y /= v;
                }
            }
            return this;
        }

        dot(v) {
            return this.x * v.x + this.y * v.y;
        }

        cross(v) {
            return this.x * v.y - this.y * v.x;
        }

        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y);
        }

        lengthSq() {
            return this.x * this.x + this.y * this.y;
        }

        normalize() {
            const len = this.length();
            if (len !== 0) {
                this.x /= len;
                this.y /= len;
            }
            return this;
        }

        angle() {
            return Math.atan2(this.y, this.x);
        }

        rotate(angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = this.x * cos - this.y * sin;
            const y = this.x * sin + this.y * cos;
            this.x = x;
            this.y = y;
            return this;
        }

        distanceTo(v) {
            const dx = this.x - v.x;
            const dy = this.y - v.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        clone() {
            return new Vec2(this.x, this.y);
        }

        equals(v) {
            return this.x === v.x && this.y === v.y;
        }

        set(x, y) {
            this.x = x;
            this.y = y;
            return this;
        }

        toString() {
            return `Vec2(${this.x}, ${this.y})`;
        }

        toArray() {
            return [this.x, this.y];
        }
    }

    /**
     * 3D Vector class
     */
    class Vec3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        // Static properties
        static get ZERO() { return new Vec3(0, 0, 0); }
        static get ONE() { return new Vec3(1, 1, 1); }
        static get I() { return new Vec3(1, 0, 0); }
        static get J() { return new Vec3(0, 1, 0); }
        static get K() { return new Vec3(0, 0, 1); }

        // Static methods
        static fromSpherical(radius, theta, phi) {
            return new Vec3(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );
        }

        static lerp(v1, v2, t) {
            return new Vec3(
                v1.x + (v2.x - v1.x) * t,
                v1.y + (v2.y - v1.y) * t,
                v1.z + (v2.z - v1.z) * t
            );
        }

        // Instance methods
        add(v) {
            if (v instanceof Vec3) {
                this.x += v.x;
                this.y += v.y;
                this.z += v.z;
            } else {
                this.x += v;
                this.y += v;
                this.z += v;
            }
            return this;
        }

        sub(v) {
            if (v instanceof Vec3) {
                this.x -= v.x;
                this.y -= v.y;
                this.z -= v.z;
            } else {
                this.x -= v;
                this.y -= v;
                this.z -= v;
            }
            return this;
        }

        mul(v) {
            if (v instanceof Vec3) {
                this.x *= v.x;
                this.y *= v.y;
                this.z *= v.z;
            } else {
                this.x *= v;
                this.y *= v;
                this.z *= v;
            }
            return this;
        }

        div(v) {
            if (v instanceof Vec3) {
                if (v.x !== 0) this.x /= v.x;
                if (v.y !== 0) this.y /= v.y;
                if (v.z !== 0) this.z /= v.z;
            } else {
                if (v !== 0) {
                    this.x /= v;
                    this.y /= v;
                    this.z /= v;
                }
            }
            return this;
        }

        dot(v) {
            return this.x * v.x + this.y * v.y + this.z * v.z;
        }

        cross(v) {
            const x = this.y * v.z - this.z * v.y;
            const y = this.z * v.x - this.x * v.z;
            const z = this.x * v.y - this.y * v.x;
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        }

        length() {
            return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        }

        lengthSq() {
            return this.x * this.x + this.y * this.y + this.z * this.z;
        }

        normalize() {
            const len = this.length();
            if (len !== 0) {
                this.x /= len;
                this.y /= len;
                this.z /= len;
            }
            return this;
        }

        project(v) {
            const dot = this.dot(v);
            const len2 = v.dot(v);
            return v.clone().mul(dot / len2);
        }

        reflect(normal) {
            const dot = this.dot(normal);
            return this.sub(normal.clone().mul(2 * dot));
        }

        rotateX(angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const y = this.y * cos - this.z * sin;
            const z = this.y * sin + this.z * cos;
            this.y = y;
            this.z = z;
            return this;
        }

        rotateY(angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = this.x * cos + this.z * sin;
            const z = -this.x * sin + this.z * cos;
            this.x = x;
            this.z = z;
            return this;
        }

        rotateZ(angle) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = this.x * cos - this.y * sin;
            const y = this.x * sin + this.y * cos;
            this.x = x;
            this.y = y;
            return this;
        }

        distanceTo(v) {
            const dx = this.x - v.x;
            const dy = this.y - v.y;
            const dz = this.z - v.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }

        clone() {
            return new Vec3(this.x, this.y, this.z);
        }

        equals(v) {
            return this.x === v.x && this.y === v.y && this.z === v.z;
        }

        set(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        }

        toString() {
            return `Vec3(${this.x}, ${this.y}, ${this.z})`;
        }

        toArray() {
            return [this.x, this.y, this.z];
        }
    }

    return {
        Vec2,
        Vec3
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Vector;
}