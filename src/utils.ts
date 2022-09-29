import { Point3 } from '@/point';

export const calculateVoxelBounds = (voxels: Point3[]): { min: Point3; max: Point3 } => {
    if (voxels.length <= 0) {
        throw new Error('Cannot find bounds of empty voxel list!');
    }
    const min: { x?: number; y?: number; z?: number } = {};
    const max: { x?: number; y?: number; z?: number } = {};

    voxels.forEach((coord) => {
        min.x = Math.min(min.x ?? coord.x, coord.x);
        min.y = Math.min(min.y ?? coord.y, coord.y);
        min.z = Math.min(min.z ?? coord.z, coord.z);
        max.x = Math.max(max.x ?? coord.x, coord.x);
        max.y = Math.max(max.y ?? coord.y, coord.y);
        max.z = Math.max(max.z ?? coord.z, coord.z);
    });

    if (min.x === undefined || isNaN(min.x)) {
        throw new Error(`Invalid x min: ${min.x}`);
    }
    if (max.x === undefined || isNaN(max.x)) {
        throw new Error(`Invalid x max: ${max.x}`);
    }
    if (min.y === undefined || isNaN(min.y)) {
        throw new Error(`Invalid y min: ${min.y}`);
    }
    if (max.y === undefined || isNaN(max.y)) {
        throw new Error(`Invalid y max: ${max.y}`);
    }
    if (min.z === undefined || isNaN(min.z)) {
        throw new Error(`Invalid z min: ${min.z}`);
    }
    if (max.z === undefined || isNaN(max.z)) {
        throw new Error(`Invalid z max: ${max.z}`);
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
        min: new Point3(min.x, min.y, min.z),
        max: new Point3(max.x, max.y, max.z),
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
