import { describe, it, expect } from '@jest/globals';
import { Point2, Point3 } from '@/point.js';

describe('Point2', () => {
    it('has a pretty toString', () => {
        expect(new Point2(1, 2).toString()).toBe('1,2');
    });

    it('can be cloned', () => {
        const point = new Point2(2, 3);
        const cloned = point.clone();
        expect(cloned).not.toBe(point);
        expect(cloned.x).toBe(point.x);
        expect(cloned.y).toBe(point.y);
    });

    it('can copy to another point', () => {
        const point1 = new Point2(1, 2);
        const point2 = new Point2(0, 0);

        expect(point2.x).toBe(0);
        expect(point2.y).toBe(0);

        point1.copyTo(point2);

        expect(point1.x).toBe(1);
        expect(point1.y).toBe(2);
        expect(point2.x).toBe(1);
        expect(point2.y).toBe(2);
    });

    it('can be transformed into a length', () => {
        const point = new Point2(4, 7);
        const length = point.toLength();
        expect(point.x).toBe(4);
        expect(point.y).toBe(7);
        expect(length.x).toBe(5);
        expect(length.y).toBe(8);
    });
});

describe('Point3', () => {
    it('has a pretty toString', () => {
        expect(new Point3(1, 2, 3).toString()).toBe('1,2,3');
    });

    it('can be cloned', () => {
        const point = new Point3(2, 3, 4);
        const cloned = point.clone();
        expect(cloned).not.toBe(point);
        expect(cloned.x).toBe(point.x);
        expect(cloned.y).toBe(point.y);
        expect(cloned.z).toBe(point.z);
    });

    it('can copy to another point', () => {
        const point1 = new Point3(1, 2, 3);
        const point2 = new Point3(0, 0, 0);

        expect(point2.x).toBe(0);
        expect(point2.y).toBe(0);
        expect(point2.z).toBe(0);

        point1.copyTo(point2);

        expect(point1.x).toBe(1);
        expect(point1.y).toBe(2);
        expect(point1.z).toBe(3);
        expect(point2.x).toBe(1);
        expect(point2.y).toBe(2);
        expect(point2.z).toBe(3);
    });

    it('can be transformed into a length', () => {
        const point = new Point3(4, 7, 10);
        const length = point.toLength();
        expect(point.x).toBe(4);
        expect(point.y).toBe(7);
        expect(point.z).toBe(10);
        expect(length.x).toBe(5);
        expect(length.y).toBe(8);
        expect(length.z).toBe(11);
    });
});
