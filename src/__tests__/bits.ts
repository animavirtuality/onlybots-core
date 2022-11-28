import { describe, it, expect } from '@jest/globals';

import { mapAsciiToBits, mapBitsToAscii, ReadingBitBuffer, splitBits, WritingBitBuffer } from '@/bits';

describe('splitBits', () => {
    it('handles 0', () => {
        const [bytes, bits] = splitBits(0);

        expect(bytes).toBe(0);
        expect(bits).toBe(0);
    });
    it('handles multiples of 8', () => {
        const [bytes, bits] = splitBits(16);

        expect(bytes).toBe(2);
        expect(bits).toBe(0);
    });
    it('handles non-multiples of 8', () => {
        const [bytes, bits] = splitBits(43);

        expect(bytes).toBe(5);
        expect(bits).toBe(3);
    });
});

const validAsciiCharacters: Buffer = Buffer.from(
    ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\\^_|~',
    'ascii'
);
const validBinaryCharacters: Buffer = Buffer.from(
    '000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F',
    'hex'
);

describe('mapAsciiToBits', () => {
    it('maps valid characters', () => {
        const result: Buffer = Buffer.from(validAsciiCharacters.map(mapAsciiToBits));
        expect(result.toString('hex').toLowerCase()).toBe(validBinaryCharacters.toString('hex').toLowerCase());
    });

    it('throws for invalid characters', () => {
        let tested = 0;
        Array.from({ length: 256 }, (_, i) => i)
            .filter((c) => !validAsciiCharacters.includes(c))
            .forEach((c) => {
                tested++;
                expect(() => {
                    mapAsciiToBits(c);
                }).toThrow(`Invalid character: ${c.toString(10)}`);
            });

        expect(tested).toBe(192);
    });
});

describe('mapBitsToAscii', () => {
    it('maps valid characters', () => {
        const result: Buffer = Buffer.from(validBinaryCharacters.map(mapBitsToAscii));
        expect(result.toString('ascii')).toBe(validAsciiCharacters.toString('ascii'));
    });

    it('throws for invalid characters', () => {
        let tested = 0;
        Array.from({ length: 256 }, (_, i) => i)
            .filter((b) => !validBinaryCharacters.includes(b))
            .forEach((b) => {
                tested++;
                expect(() => {
                    mapBitsToAscii(b);
                }).toThrow(`Invalid bits: ${b.toString(10)}`);
            });

        expect(tested).toBe(192);
    });
});

const parsePrettyBinary = (pretty: string): Buffer => {
    if (pretty.length % 8 !== 0) {
        throw new Error('pretty binary length must be a multiple of 8!');
    }

    return Buffer.from(
        Array.from({ length: pretty.length / 8 }, (_, i) => parseInt(pretty.slice(i * 8, i * 8 + 8), 2))
    );
};

describe('ReadingBitBuffer', () => {
    it('throws for invalid length', () => {
        const buffer = new ReadingBitBuffer(Buffer.alloc(1, 0));
        expect(() => buffer.hasRemaining(0)).toThrow('length must be between 1 and 52: 0');
        expect(() => buffer.hasRemaining(53)).toThrow('length must be between 1 and 52: 53');
    });

    it('throws when reading past the end of the buffer', () => {
        const buffer = new ReadingBitBuffer(Buffer.alloc(1, 0));
        expect(buffer.readUIntBitsBE(2)).toBe(0);
        expect(() => buffer.readUIntBitsBE(8)).toThrow('overflow!');
    });

    it('works for empty buffer', () => {
        const buffer = new ReadingBitBuffer(Buffer.alloc(0));
        expect(buffer.hasRemaining(1)).toBe(false);
    });

    it('works for buffer of one byte', () => {
        const buffer = new ReadingBitBuffer(parsePrettyBinary('01100010'));
        expect(buffer.readUIntBitsBE(3)).toBe(3);
    });

    it('can read across byte boundaries', () => {
        const buffer = new ReadingBitBuffer(parsePrettyBinary('0011011010100101'));
        expect(buffer.readUIntBitsBE(6)).toBe(13);
        expect(buffer.readUIntBitsBE(5)).toBe(21);
    });

    it('can read more than one byte', () => {
        const buffer = new ReadingBitBuffer(parsePrettyBinary('10001010111010100001101111001010'));
        expect(buffer.readUIntBitsBE(3)).toBe(4);
        expect(buffer.readUIntBitsBE(29)).toBe(183114698);
    });
});

const formatPrettyBinary = (buffer: Buffer): string => {
    return [...buffer].map((b: number) => b.toString(2).padStart(8, '0')).join('');
};

describe('WritingBitBuffer', () => {
    it('throws for invalid length', () => {
        const buffer = new WritingBitBuffer(1);
        expect(() => buffer.writeUIntBitsBE(0, 0)).toThrow('length must be between 1 and 52: 0');
        expect(() => buffer.writeUIntBitsBE(53, 0)).toThrow('length must be between 1 and 52: 53');
    });

    it('throws when writing past the end of the buffer', () => {
        const buffer = new WritingBitBuffer(4);
        expect(() => buffer.writeUIntBitsBE(5, 0)).toThrow('overflow!');
    });

    it('throws on negative values', () => {
        const buffer = new WritingBitBuffer(8);
        expect(() => buffer.writeUIntBitsBE(4, -1)).toThrow('value must be positive: -1');
    });

    it('throws when value is too large for bit size specified', () => {
        const buffer = new WritingBitBuffer(16);
        expect(() => buffer.writeUIntBitsBE(4, 16)).toThrow('value is too large for length: 16 > 15');
    });

    it('throws when ending without filling buffer', () => {
        expect(() => new WritingBitBuffer(8).end()).toThrow("buffer offset doesn't match size: 0 !== 8");
    });

    it('throws when ending if (somehow) offset doesn\t match buffer length', () => {
        const buffer = new WritingBitBuffer(16);
        // This is really the only way this can happen
        (buffer as unknown as any).size = 0;
        expect(() => buffer.end()).toThrow("buffer length doesn't match offset: 2 !== 0");
    });

    it('can write less than one byte', () => {
        const buffer = new WritingBitBuffer(4);
        buffer.writeUIntBitsBE(2, 1);
        buffer.writeUIntBitsBE(2, 3);
        expect(formatPrettyBinary(buffer.end())).toBe('01110000');
    });

    it('can write across byte boundaries', () => {
        const buffer = new WritingBitBuffer(14);
        buffer.writeUIntBitsBE(6, 0);
        buffer.writeUIntBitsBE(5, 31);
        buffer.writeUIntBitsBE(3, 0);
        expect(formatPrettyBinary(buffer.end())).toBe('0000001111100000');
    });

    it('can write more than one byte', () => {
        const buffer = new WritingBitBuffer(32);
        buffer.writeUIntBitsBE(3, 0);
        buffer.writeUIntBitsBE(29, 398456815);
        expect(formatPrettyBinary(buffer.end())).toBe('00010111101111111111011111101111');
    });
});
