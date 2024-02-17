import { describe, it, expect } from '@jest/globals';
import { OnlyBot } from '@/bot.js';
import { Point3 } from '@/point.js';
import { CompressedBots } from '@/compressed.js';

const bot1 = new OnlyBot(
    'BOT ONE',
    { x: 0, y: 0, z: 0 },
    [
        { color: [255, 0, 0], preset: 1 },
        { color: [0, 255, 0], preset: 2 },
    ],
    [
        {
            material: 0,
            type: 0,
            voxels: [
                new Point3(0, 0, 0),
                new Point3(15, 0, 0),
                new Point3(15, 15, 0),
                new Point3(15, 15, 15),
                new Point3(0, 15, 0),
                new Point3(0, 15, 15),
                new Point3(0, 0, 15),
                new Point3(15, 0, 15),
            ],
        },
        {
            material: 1,
            type: 1,
            voxels: [new Point3(7, 7, 7), new Point3(6, 7, 7), new Point3(7, 6, 7), new Point3(6, 6, 7)],
        },
    ]
);

const bot2 = new OnlyBot(
    'BOT TWO',
    { x: -15, y: 7, z: 15 },
    [
        { color: [255, 0, 0], preset: 100 },
        { color: [0, 0, 255], preset: 40 },
    ],
    [
        {
            type: 5,
            material: 0,
            voxels: [new Point3(0, 0, 0), new Point3(0, 1, 0), new Point3(0, 1, 1), new Point3(0, 1, 15)],
        },
        {
            type: 2,
            material: 1,
            voxels: [new Point3(0, 0, 0), new Point3(8, 8, 8)],
        },
        {
            type: 4,
            material: 1,
            voxels: [
                new Point3(3, 3, 3),
                new Point3(10, 3, 3),
                new Point3(10, 10, 3),
                new Point3(10, 10, 10),
                new Point3(3, 10, 3),
                new Point3(3, 10, 10),
                new Point3(3, 3, 10),
                new Point3(10, 3, 10),
            ],
        },
    ]
);

describe('CompressedBots', () => {
    it('compresses and uncompresses a single bot', () => {
        const compressed = CompressedBots.compress([bot1]);
        expect(compressed.colors.length).toBe(2);
        expect(compressed.bots.length).toBe(1);

        const buffer = compressed.toBuffer();
        expect(buffer.toString('hex')).toBe(
            '1ff8000007f8000799a2bf402fba58082018118400019c00003c3c03ffc03c3ffc3ffcacce110f'
        );

        const recovered = CompressedBots.fromBuffer(buffer);
        const expanded = recovered.expand();
        expect(expanded.length).toBe(1);
        expect(expanded[0].toJSON()).toBe(bot1.toJSON());
    });

    it('compresses and uncompresses multiple bots', () => {
        const compressed = CompressedBots.compress([bot1, bot2]);
        expect(bot1.materials.length).toBe(2);
        expect(bot2.materials.length).toBe(2);
        expect(compressed.colors.length).toBe(3);
        expect(compressed.bots.length).toBe(2);

        const buffer = compressed.toBuffer();
        expect(buffer.toString('hex')).toBe(
            '2bfc000003fc000003fc03d4d15fa017dd2c041005023080003380000787807ff80787ff87ff9599c221e024668afd00d37bdffe8c91418a8001ac0040447d20018400222226671c00071c0ff81c7fc7fc'
        );

        const recovered = CompressedBots.fromBuffer(buffer);
        const expanded = recovered.expand();
        expect(expanded.length).toBe(2);
        expect(expanded[0].toJSON()).toBe(bot1.toJSON());
        expect(expanded[1].toJSON()).toBe(bot2.toJSON());
    });
});
