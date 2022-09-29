import { describe, it, expect } from '@jest/globals';
import { calculateVoxelBounds } from '@/utils';
import { Point3 } from '@/point';

describe('calculateVoxelBounds', () => {
    it('throws on invalid input', () => {
        expect(() => calculateVoxelBounds([])).toThrow('Cannot find bounds of empty voxel list!');
        expect(() => calculateVoxelBounds([new Point3(undefined as unknown as number, 0, 0)])).toThrow(
            'Invalid x min: NaN'
        );
        expect(() => calculateVoxelBounds([new Point3(0, undefined as unknown as number, 0)])).toThrow(
            'Invalid y min: NaN'
        );
        expect(() => calculateVoxelBounds([new Point3(0, 0, undefined as unknown as number)])).toThrow(
            'Invalid z min: NaN'
        );
        expect(() => calculateVoxelBounds([new Point3(-1, 0, 0)])).toThrow('Negative x min');
        expect(() => calculateVoxelBounds([new Point3(0, -1, 0)])).toThrow('Negative y min');
        expect(() => calculateVoxelBounds([new Point3(0, 0, -1)])).toThrow('Negative z min');
    });
});
