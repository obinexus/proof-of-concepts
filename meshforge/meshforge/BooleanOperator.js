import { Vector } from './Vector.js';
import { Matrix } from './Matrix.js';

/**
 * A comprehensive 3D Boolean Operations library for CSG operations
 * @module BooleanOperations
 */
export class Vertex {
    constructor(position, normal = null, uv = null) {
        this.position = position.clone();
        this.normal = normal ? normal.clone() : new Vector.Vec3(0, 0, 0);
        this.uv = uv || [0, 0];
    }

    clone() {
        return new Vertex(this.position, this.normal, [...this.uv]);
    }
}

export class Polygon {
    constructor(vertices) {
        this.vertices = vertices;
        this.plane = this.calculatePlane();
    }

    calculatePlane() {
        const v1 = this.vertices[1].position.clone().sub(this.vertices[0].position);
        const v2 = this.vertices[2].position.clone().sub(this.vertices[0].position);
        const normal = v1.cross(v2).normalize();
        const w = normal.dot(this.vertices[0].position);
        return { normal, w };
    }

    clone() {
        return new Polygon(this.vertices.map(v => v.clone()));
    }

    flip() {
        this.vertices.reverse();
        this.vertices.forEach(v => v.normal.mul(-1));
        this.plane.normal.mul(-1);
        this.plane.w = -this.plane.w;
    }
}

export class BSPNode {
    constructor(polygons = null) {
        this.plane = null;
        this.front = null;
        this.back = null;
        this.polygons = [];

        if (polygons) this.build(polygons);
    }

    clone() {
        const node = new BSPNode();
        node.plane = this.plane && { ...this.plane };
        node.front = this.front && this.front.clone();
        node.back = this.back && this.back.clone();
        node.polygons = this.polygons.map(p => p.clone());
        return node;
    }

    invert() {
        for (const poly of this.polygons) {
            poly.flip();
        }
        
        if (this.plane) {
            this.plane.normal.mul(-1);
            this.plane.w = -this.plane.w;
        }

        if (this.front) this.front.invert();
        if (this.back) this.back.invert();

        const temp = this.front;
        this.front = this.back;
        this.back = temp;
    }

    clipPolygons(polygons) {
        if (!this.plane) return [...polygons];

        let front = [], back = [];

        for (const poly of polygons) {
            this.splitPolygon(poly, front, back, front, back);
        }

        if (this.front) front = this.front.clipPolygons(front);
        if (this.back) back = this.back.clipPolygons(back);

        return [...front, ...back];
    }

    clipTo(bsp) {
        this.polygons = bsp.clipPolygons(this.polygons);
        if (this.front) this.front.clipTo(bsp);
        if (this.back) this.back.clipTo(bsp);
    }

    allPolygons() {
        let polygons = [...this.polygons];
        if (this.front) polygons.push(...this.front.allPolygons());
        if (this.back) polygons.push(...this.back.allPolygons());
        return polygons;
    }

    build(polygons) {
        if (!polygons.length || this.polygons.length > 1000) return;

        if (!this.plane) {
            this.plane = polygons[0].plane;
        }

        const front = [], back = [];

        for (const poly of polygons) {
            this.splitPolygon(poly, this.polygons, this.polygons, front, back);
        }

        if (front.length) {
            if (!this.front) this.front = new BSPNode();
            if (front.length !== polygons.length) {
                this.front.build(front);
            }
        }

        if (back.length) {
            if (!this.back) this.back = new BSPNode();
            if (back.length !== polygons.length) {
                this.back.build(back);
            }
        }
    }

    splitPolygon(polygon, coplanarFront, coplanarBack, front, back) {
        const EPSILON = 1e-5;
        const { normal, w } = this.plane;

        const types = polygon.vertices.map(vertex => {
            const t = normal.dot(vertex.position) - w;
            if (t < -EPSILON) return BACK;
            if (t > EPSILON) return FRONT;
            return COPLANAR;
        });

        let type = 0;
        for (const t of types) type |= t;

        switch (type) {
            case COPLANAR:
                (normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
                break;
            case FRONT:
                front.push(polygon);
                break;
            case BACK:
                back.push(polygon);
                break;
            case SPANNING:
                const f = [], b = [];
                for (let i = 0; i < polygon.vertices.length; i++) {
                    const j = (i + 1) % polygon.vertices.length;
                    const ti = types[i], tj = types[j];
                    const vi = polygon.vertices[i], vj = polygon.vertices[j];

                    if (ti !== BACK) f.push(vi);
                    if (ti !== FRONT) b.push(ti !== BACK ? vi.clone() : vi);

                    if ((ti | tj) === SPANNING) {
                        const t = (w - normal.dot(vi.position)) / normal.dot(vj.position.clone().sub(vi.position));
                        const v = interpolateVertex(vi, vj, t);
                        f.push(v);
                        b.push(v.clone());
                    }
                }

                if (f.length >= 3) front.push(new Polygon(f));
                if (b.length >= 3) back.push(new Polygon(b));
                break;
        }
    }
}

export class CSG {
    constructor() {
        this.polygons = [];
    }

    static fromGeometry(vertices, faces, normals = null, uvs = null) {
        const csg = new CSG();
        const faceVertices = [];

        for (const face of faces) {
            for (let i = 0; i < face.vertices.length; i++) {
                const vertexIndex = face.vertices[i];
                const vertex = vertices[vertexIndex];
                const normal = normals ? normals[vertexIndex] : null;
                const uv = uvs ? uvs[face.uvs[i]] : null;
                faceVertices.push(new Vertex(vertex, normal, uv));
            }
            csg.polygons.push(new Polygon(faceVertices));
        }

        return csg;
    }

    static fromMesh(mesh) {
        return CSG.fromGeometry(mesh.vertices, mesh.faces, mesh.normals, mesh.uvs);
    }

    clone() {
        const csg = new CSG();
        csg.polygons = this.polygons.map(p => p.clone());
        return csg;
    }

    toPolygons() {
        return this.polygons;
    }

    union(csg) {
        const a = new BSPNode(this.clone().polygons);
        const b = new BSPNode(csg.clone().polygons);
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());
        return CSG.fromPolygons(a.allPolygons());
    }

    subtract(csg) {
        const a = new BSPNode(this.clone().polygons);
        const b = new BSPNode(csg.clone().polygons);
        a.invert();
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());
        a.invert();
        return CSG.fromPolygons(a.allPolygons());
    }

    intersect(csg) {
        const a = new BSPNode(this.clone().polygons);
        const b = new BSPNode(csg.clone().polygons);
        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.build(b.allPolygons());
        a.invert();
        return CSG.fromPolygons(a.allPolygons());
    }

    inverse() {
        const csg = this.clone();
        csg.polygons.forEach(p => p.flip());
        return csg;
    }

    static fromPolygons(polygons) {
        const csg = new CSG();
        csg.polygons = polygons;
        return csg;
    }
}

// Constants for polygon splitting
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

function interpolateVertex(v1, v2, t) {
    const pos = v1.position.clone().mul(1 - t).add(v2.position.clone().mul(t));
    const normal = v1.normal.clone().mul(1 - t).add(v2.normal.clone().mul(t));
    const uv = [
        v1.uv[0] * (1 - t) + v2.uv[0] * t,
        v1.uv[1] * (1 - t) + v2.uv[1] * t
    ];
    return new Vertex(pos, normal, uv);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CSG, Vertex, Polygon, BSPNode };
}