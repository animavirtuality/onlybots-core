import { describe, it, expect } from '@jest/globals';

import { mapAsciiToBits, mapBitsToAscii, ReadingBitBuffer, splitBits } from '@/bits';

describe('splitBits', () => {
    it('should handle 0', () => {
        const [bytes, bits] = splitBits(0);

        expect(bytes).toEqual(0);
        expect(bits).toEqual(0);
    });
    it('should handle multiples of 8', () => {
        const [bytes, bits] = splitBits(16);

        expect(bytes).toEqual(2);
        expect(bits).toEqual(0);
    });
    it('should handle non-multiples of 8', () => {
        const [bytes, bits] = splitBits(43);

        expect(bytes).toEqual(5);
        expect(bits).toEqual(3);
    });
});

const validAsciiCharacters: Buffer = Buffer.from('abcdefghijklmnopqrstuvwxyz -', 'ascii');
const validBinaryCharacters: Buffer = Buffer.from('000102030405060708090A0B0C0D0E0F101112131415161718191A1B', 'hex');

describe('mapAsciiToBits', () => {
    it('should map valid characters', () => {
        const result: Buffer = Buffer.from(validAsciiCharacters.map(mapAsciiToBits));
        expect(result.toString('hex').toLowerCase()).toEqual(validBinaryCharacters.toString('hex').toLowerCase());
    });

    it('should throw for invalid characters', () => {
        let tested = 0;
        Array.from({ length: 128 }, (_, i) => i)
            .filter((c) => !validAsciiCharacters.includes(c))
            .forEach((c) => {
                tested++;
                expect(() => {
                    mapAsciiToBits(c);
                }).toThrow(`Invalid character: ${c.toString(10)}`);
            });

        expect(tested).toEqual(100);
    });
});

describe('mapBitsToAscii', () => {
    it('should map valid characters', () => {
        const result: Buffer = Buffer.from(validBinaryCharacters.map(mapBitsToAscii));
        expect(result.toString('ascii')).toEqual(validAsciiCharacters.toString('ascii'));
    });

    it('should throw for invalid characters', () => {
        let tested = 0;
        Array.from({ length: 128 }, (_, i) => i)
            .filter((b) => !validBinaryCharacters.includes(b))
            .forEach((b) => {
                tested++;
                expect(() => {
                    mapBitsToAscii(b);
                }).toThrow(`Invalid bits: ${b.toString(10)}`);
            });

        expect(tested).toEqual(100);
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
    it('should throw for invalid length', () => {
        const buffer = new ReadingBitBuffer(Buffer.alloc(1, 0));
        expect(() => buffer.hasRemaining(0)).toThrow('length must be between 1 and 52: 0');
        expect(() => buffer.hasRemaining(53)).toThrow('length must be between 1 and 52: 53');
    });

    it('should work for empty buffer', () => {
        const buffer = new ReadingBitBuffer(Buffer.alloc(0));
        expect(buffer.hasRemaining(1)).toBe(false);
    });

    it('should work for buffer of one byte', () => {
        const buffer = new ReadingBitBuffer(parsePrettyBinary('01100010'));
        expect(buffer.readUIntBitsBE(3)).toEqual(3);
    });
});
