export const splitBits = (bits: number): [number, number] => [Math.floor(bits / 8), bits % 8];

export const allocBits = (n: number): Buffer => {
    const [bytes, bits] = splitBits(n);
    return Buffer.alloc(bytes + (bits > 0 ? 1 : 0));
};

export const mapAsciiToBits = (c: number): number => {
    if (c >= 97 && c <= 122) {
        return c - 97;
    }

    if (c === 32) {
        return 26;
    }

    if (c === 45) {
        return 27;
    }

    throw new Error(`Invalid character: ${c}`);
};

export const mapBitsToAscii = (bits: number): number => {
    if (bits >= 0 && bits <= 25) {
        return bits + 97;
    }

    if (bits === 26) {
        return 32;
    }

    if (bits === 27) {
        return 45;
    }

    throw new Error(`Invalid bits: ${bits}`);
};

export class WritingBitBuffer {
    private readonly size: number;
    private readonly buffer: Buffer;
    private offset: number = 0;

    constructor(size: number) {
        this.size = size;
        this.buffer = allocBits(size);
    }

    public writeUIntBitsBE(this: WritingBitBuffer, length: number, value: number): void {
        if (length < 1 || length > 52) {
            throw new Error('length must be between 1 and 52: ' + length);
        }
        if (value < 0) {
            throw new Error('value must be positive: ' + value);
        }
        if (value > (1 << length) - 1) {
            throw new Error(`value is too large for length: ${value} > ${(1 << length) - 1}`);
        }

        const [bytes, bits] = splitBits(this.offset);
        const bytesToRead = Math.ceil((bits + length) / 8);

        const shift = bytesToRead * 8 - (bits + length);
        const mask = Math.pow(2, length) - 1;
        const replacement = value << shift;
        const existing = this.buffer.readUIntBE(bytes, bytesToRead);
        const prepared = existing & ~(mask << shift);
        const updated = prepared | replacement;

        this.buffer.writeUIntBE(updated, bytes, bytesToRead);
        this.offset += length;
    }

    public end(this: WritingBitBuffer): Buffer {
        if (this.offset !== this.size) {
            throw new Error(`buffer offset doesn't match size: ${this.offset} !== ${this.size}`);
        }

        if (Math.ceil(this.offset / 8) !== this.buffer.length) {
            throw new Error(
                `buffer length doesn't match offset: ${this.buffer.length} !== ${Math.ceil(this.offset / 8)}`
            );
        }

        return this.buffer;
    }
}

export class ReadingBitBuffer {
    private readonly buffer: Buffer;
    private offset: number = 0;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
    }

    public hasRemaining(this: ReadingBitBuffer, length: number): boolean {
        return this.buffer.length * 8 - this.offset >= length;
    }

    public readUIntBitsBE(this: ReadingBitBuffer, length: number): number {
        if (length < 1 || length > 52) {
            throw new Error('length must be between 1 and 52: ' + length);
        }

        const [bytes, bits] = splitBits(this.offset);
        const bytesToRead = Math.ceil((bits + length) / 8);

        const shift = bytesToRead * 8 - (bits + length);
        const mask = Math.pow(2, length) - 1;
        const value = this.buffer.readUIntBE(bytes, bytesToRead) >> shift;

        this.offset += length;
        return value & mask;
    }
}
