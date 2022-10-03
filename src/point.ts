export class Point2 {
    public x: number;
    public y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public toString(this: Point2): string {
        return `${this.x.toString(10)},${this.y.toString(10)}`;
    }

    public clone(this: Point2): Point2 {
        return new Point2(this.x, this.y);
    }

    public copyTo(this: Point2, other: Point2): void {
        other.x = this.x;
        other.y = this.y;
    }

    public toLength(this: Point2): Point2 {
        return new Point2(Math.abs(this.x) + 1, Math.abs(this.y) + 1);
    }
}

export class Point3 extends Point2 {
    public z: number;

    constructor(x: number, y: number, z: number) {
        super(x, y);
        this.z = z;
    }

    public toString(this: Point3): string {
        return `${this.x.toString(10)},${this.y.toString(10)},${this.z.toString(10)}`;
    }

    public clone(this: Point3): Point3 {
        return new Point3(this.x, this.y, this.z);
    }

    public copyTo(this: Point3, other: Point3): void {
        other.x = this.x;
        other.y = this.y;
        other.z = this.z;
    }

    public toLength(this: Point3): Point3 {
        return new Point3(Math.abs(this.x) + 1, Math.abs(this.y) + 1, Math.abs(this.z) + 1);
    }
}

export class Point3Set {
    private readonly set = new Set<string>();

    constructor(voxels?: Point3[]) {
        if (voxels) {
            voxels.forEach((voxel) => {
                this.set.add(voxel.toString());
            });
        }
    }

    public addPoint(this: Point3Set, point: Point3): void {
        this.set.add(point.toString());
    }

    public add(this: Point3Set, x: number, y: number, z: number): void {
        this.addPoint(new Point3(x, y, z));
    }

    public hasPoint(this: Point3Set, point: Point3): boolean {
        return this.set.has(point.toString());
    }

    public has(this: Point3Set, x: number, y: number, z: number): boolean {
        return this.hasPoint(new Point3(x, y, z));
    }
}
