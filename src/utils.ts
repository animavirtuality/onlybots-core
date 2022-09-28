import { Point3 } from '@/point';

export const calculateVoxelBounds = (voxels: Point3[]): { min: Point3; max: Point3 } => {
    const min = new Point3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = new Point3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    voxels.forEach((coord) => {
        min.x = Math.min(min.x, coord.x);
        min.y = Math.min(min.y, coord.y);
        min.z = Math.min(min.z, coord.z);
        max.x = Math.max(max.x, coord.x);
        max.y = Math.max(max.y, coord.y);
        max.z = Math.max(max.z, coord.z);
    });

    if (min.x === Number.MAX_SAFE_INTEGER) {
        throw new Error('Unset x min');
    }
    if (max.x === Number.MIN_SAFE_INTEGER) {
        throw new Error('Unset x max');
    }
    if (min.y === Number.MAX_SAFE_INTEGER) {
        throw new Error('Unset y min');
    }
    if (max.y === Number.MIN_SAFE_INTEGER) {
        throw new Error('Unset y max');
    }
    if (min.z === Number.MAX_SAFE_INTEGER) {
        throw new Error('Unset z min');
    }
    if (max.z === Number.MIN_SAFE_INTEGER) {
        throw new Error('Unset z max');
    }

    if (min.x < 0) {
        throw new Error('Negative x min');
    }
    if (min.y < 0) {
        throw new Error('Negative y min');
    }
    if (min.z < 0) {
        throw new Error('Negative z min');
    }

    if (min.x > max.x) {
        throw new Error(`x bounds are invalid: ${min.x} > ${max.x}`);
    }
    if (min.y > max.y) {
        throw new Error(`y bounds are invalid: ${min.y} > ${max.y}`);
    }
    if (min.z > max.z) {
        throw new Error(`z bounds are invalid: ${min.z} > ${max.z}`);
    }

    return {
        min,
        max,
    };
};

export const packVoxelSpace = (voxels: Point3[]): Point3 => {
    const { min, max } = calculateVoxelBounds(voxels);

    if (min.x !== 0) {
        const shift = min.x;
        voxels.forEach((coord) => {
            coord.x -= shift;
        });
    }
    if (min.y !== 0) {
        const shift = min.y;
        voxels.forEach((coord) => {
            coord.y -= shift;
        });
    }
    if (min.z !== 0) {
        const shift = min.z;
        voxels.forEach((coord) => {
            coord.z -= shift;
        });
    }

    return new Point3(max.x - min.x, max.y - min.y, max.z - min.z);
};
