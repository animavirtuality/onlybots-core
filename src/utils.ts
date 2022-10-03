import { Point3 } from '@/point';

export const calculateVoxelBounds = (voxels: Point3[]): { min: Point3; max: Point3 } => {
    if (voxels.length <= 0) {
        throw new Error('Cannot find bounds of empty voxel list!');
    }
    const min: { x?: number; y?: number; z?: number } = {};
    const max: { x?: number; y?: number; z?: number } = {};

    voxels.forEach((voxel) => {
        min.x = Math.min(min.x ?? voxel.x, voxel.x);
        min.y = Math.min(min.y ?? voxel.y, voxel.y);
        min.z = Math.min(min.z ?? voxel.z, voxel.z);
        max.x = Math.max(max.x ?? voxel.x, voxel.x);
        max.y = Math.max(max.y ?? voxel.y, voxel.y);
        max.z = Math.max(max.z ?? voxel.z, voxel.z);
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
        voxels.forEach((voxel) => {
            voxel.x -= shift;
        });
    }
    if (min.y !== 0) {
        const shift = min.y;
        voxels.forEach((voxel) => {
            voxel.y -= shift;
        });
    }
    if (min.z !== 0) {
        const shift = min.z;
        voxels.forEach((voxel) => {
            voxel.z -= shift;
        });
    }

    return new Point3(max.x - min.x, max.y - min.y, max.z - min.z);
};
