import { describe, test } from '@jest/globals';
import { expect } from 'chai';
import { OnlyBot, OnlyBotAnchor, OnlyBotMaterial } from '@/bot';
import { Point3 } from '@/point';

describe('OnlyBot', () => {
    test('should construct a bot from valid json', () => {
        OnlyBot.fromJSON({
            name: 'bot',
            anchor: {
                x: 0,
                y: 0,
                z: 0,
            },
            materials: [
                {
                    color: [0, 0, 0],
                    shader: 0,
                },
            ],
            layers: [
                {
                    type: 0,
                    material: 0,
                    voxels: [[0, 0, 0]],
                },
            ],
        });
    });

    test('should throw when given invalid json', () => {
        expect(() => {
            OnlyBot.fromJSON({});
        }).to.throw('Validation failed:');
    });

    test('should serialize voxels stably', () => {
        const name = 'name';
        const anchor: OnlyBotAnchor = { x: 0, y: 0, z: 0 };
        const materials: OnlyBotMaterial[] = [{ color: [0, 0, 0], shader: 0 }];
        const voxels: Point3[] = [
            new Point3(0, 0, 0),
            new Point3(0, 1, 0),
            new Point3(1, 0, 0),
            new Point3(0, 0, 2),
            new Point3(0, 2, 1),
        ];
        const bot1 = new OnlyBot(name, anchor, materials, [{ type: 0, material: 0, voxels }]);
        const bot2 = new OnlyBot(name, anchor, materials, [
            { type: 0, material: 0, voxels: voxels.slice(0).reverse() },
        ]);

        const indent = '  ';
        expect(bot1.toJSON(indent)).to.eq(bot2.toJSON(indent));
    });
});
