import { describe, it, expect } from '@jest/globals';
import { OnlyBot, OnlyBotAnchor, OnlyBotMaterial } from '@/bot';
import { Point3 } from '@/point';

describe('OnlyBot', () => {
    it('constructs a bot from valid json', () => {
        expect(() => {
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
        }).not.toThrow();
    });

    it('throws when given invalid json', () => {
        expect(() => {
            OnlyBot.fromJSON({});
        }).toThrow('Validation failed:');
    });

    it('serializes voxels stably', () => {
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
        const json1 = bot1.toJSON(indent);
        const json2 = bot2.toJSON(indent);
        expect(json1).toBe(json2);
        expect(() => JSON.parse(json1)).not.toThrow();
    });

    it('can flatten voxel list', () => {
        const voxel1 = new Point3(0, 0, 0);
        const voxel2 = new Point3(3, 2, 4);
        const voxel3 = new Point3(5, 6, 8);

        const bot = new OnlyBot(
            '',
            { x: 0, y: 0, z: 0 },
            [{ color: [0, 0, 0], shader: 0 }],
            [
                { type: 0, material: 0, voxels: [voxel1] },
                { type: 0, material: 0, voxels: [voxel3, voxel2] },
            ]
        );

        const voxels = bot.voxels();
        expect(voxels.length).toBe(3);
        expect(voxels.includes(voxel1)).toBe(true);
        expect(voxels.includes(voxel2)).toBe(true);
        expect(voxels.includes(voxel3)).toBe(true);
    });

    it('packs voxels to 0,0,0 in constructor', () => {
        const voxel1 = new Point3(2, 5, 12);
        const voxel2 = new Point3(15, 4, 9);
        const voxel3 = new Point3(7, 14, 8);
        const voxel4 = new Point3(10, 10, 10);

        new OnlyBot(
            '',
            { x: 0, y: 0, z: 0 },
            [{ color: [0, 0, 0], shader: 0 }],
            [{ type: 0, material: 0, voxels: [voxel1, voxel2, voxel3, voxel4] }]
        );

        expect(voxel1.x).toBe(0);
        expect(voxel1.y).toBe(1);
        expect(voxel1.z).toBe(4);

        expect(voxel2.x).toBe(13);
        expect(voxel2.y).toBe(0);
        expect(voxel2.z).toBe(1);

        expect(voxel3.x).toBe(5);
        expect(voxel3.y).toBe(10);
        expect(voxel3.z).toBe(0);

        expect(voxel4.x).toBe(8);
        expect(voxel4.y).toBe(6);
        expect(voxel4.z).toBe(2);
    });
});
