import { Point2, Point3 } from '@/point';
import { OnlyBot, OnlyBotLayer, OnlyBotMaterial } from '@/bot';
import { mapAsciiToBits, mapBitsToAscii, ReadingBitBuffer, WritingBitBuffer } from '@/bits';
import { calculateVoxelBounds, packVoxelSpace } from '@/utils';

const BITS = {
    COLOR_COUNT: 9,
    COLOR_RGB: 8,
    BOT_LENGTH: 12,
    NAME_COUNT: 5,
    NAME_CHAR: 5,
    ANCHOR_XZ_SIGN: 1,
    ANCHOR_X: 4,
    ANCHOR_Y: 3,
    ANCHOR_Z: 4,
    MATERIAL_COUNT: 2,
    MATERIAL_COLOR: 9,
    MATERIAL_SHADER: 8,
    LAYER_COUNT: 5,
    LAYER_TYPE: 3,
    LAYER_MATERIAL: 2,
    FOURBIT_FLAG: 1,
    ORIGIN: 4,
    FORMAT_FLAG: 1,
    FIELD_FLAG: 1,
    DIRECTION: 2,
    LAYER_LIST_COUNT: 6,
};

export class Field3 {
    public readonly length: Point3;
    public readonly xyz: boolean[][][];

    constructor(length: Point3, voxels?: Point3[]) {
        this.length = length;
        this.xyz = Array.from(Array(length.x), () => Array.from(Array(length.y), () => Array(length.z).fill(false)));
        if (voxels) {
            voxels.forEach((voxel) => {
                this.xyz[voxel.x][voxel.y][voxel.z] = true;
            });
        }
    }
}

export class CompressedLayer {
    public readonly type: number;
    public readonly material: number;
    public readonly data: CompressedLayerData;

    constructor(type: number, material: number, data: CompressedLayerData) {
        this.type = type;
        this.material = material;
        this.data = data;
    }

    public static compress(layer: OnlyBotLayer): CompressedLayer {
        // clone the coordinates
        if (layer.voxels.length < 1) {
            throw new Error('Layer has no voxels!');
        }
        const coords = layer.voxels.map((voxel) => voxel.clone());
        const origin = calculateVoxelBounds(coords).min;

        const max = packVoxelSpace(coords);
        const length = max.toLength();

        return new CompressedLayer(layer.type, layer.material, CompressedLayerData.compress(origin, length, coords));
    }

    public static fromBuffer(buffer: ReadingBitBuffer): CompressedLayer {
        const type = buffer.readUIntBitsBE(BITS.LAYER_TYPE);
        const material = buffer.readUIntBitsBE(BITS.LAYER_MATERIAL);
        const data = CompressedLayerData.fromBuffer(buffer);

        return new CompressedLayer(type, material, data);
    }

    public compressedSizeInBits(this: CompressedLayer): number {
        let size = 0;
        size += BITS.LAYER_TYPE;
        size += BITS.LAYER_MATERIAL;
        size += this.data.compressedSizeInBits();
        return size;
    }

    public toBuffer(this: CompressedLayer, buffer: WritingBitBuffer): void {
        buffer.writeUIntBitsBE(BITS.LAYER_TYPE, this.type);
        buffer.writeUIntBitsBE(BITS.LAYER_MATERIAL, this.material);
        this.data.toBuffer(buffer);
    }

    public expand(): OnlyBotLayer {
        const voxels = this.data.expand();

        return {
            type: this.type,
            material: this.material,
            voxels,
        };
    }
}

export abstract class CompressedLayerData {
    public readonly fourbit: boolean;
    public readonly origin: Point3;
    public abstract readonly format: boolean;

    protected constructor(fourbit: boolean, origin: Point3) {
        this.fourbit = fourbit;
        this.origin = origin;
    }

    public static compress(origin: Point3, length: Point3, coords: Point3[]): CompressedLayerData {
        const dataField = CompressedLayerDataField.compress(origin, length, coords);
        const dataList = CompressedLayerDataList.compress(origin, length, coords);

        return dataList.overflow() || dataField.compressedSizeInBits() < dataList.compressedSizeInBits()
            ? dataField
            : dataList;
    }

    public static fromBuffer(buffer: ReadingBitBuffer): CompressedLayerData {
        const coordinateBitSize = buffer.readUIntBitsBE(BITS.FOURBIT_FLAG) > 0 ? 4 : 3;
        const origin = new Point3(
            buffer.readUIntBitsBE(BITS.ORIGIN),
            buffer.readUIntBitsBE(BITS.ORIGIN),
            buffer.readUIntBitsBE(BITS.ORIGIN)
        );
        const format = buffer.readUIntBitsBE(BITS.FORMAT_FLAG);

        return format
            ? CompressedLayerDataList.fromBufferWithOrigin(buffer, coordinateBitSize, origin)
            : CompressedLayerDataField.fromBufferWithOrigin(buffer, coordinateBitSize, origin);
    }

    protected coordinateBitSize(this: CompressedLayerData): number {
        return this.fourbit ? 4 : 3;
    }

    public compressedSizeInBits(): number {
        let size = 0;
        size += BITS.FOURBIT_FLAG;
        size += 3 * BITS.ORIGIN;
        size += BITS.FORMAT_FLAG;
        return size;
    }

    public toBuffer(buffer: WritingBitBuffer): void {
        buffer.writeUIntBitsBE(BITS.FOURBIT_FLAG, this.fourbit ? 1 : 0);
        buffer.writeUIntBitsBE(BITS.ORIGIN, this.origin.x);
        buffer.writeUIntBitsBE(BITS.ORIGIN, this.origin.y);
        buffer.writeUIntBitsBE(BITS.ORIGIN, this.origin.z);
        buffer.writeUIntBitsBE(BITS.FORMAT_FLAG, this.format ? 1 : 0);
    }

    public expand(this: CompressedLayerData): Point3[] {
        const coords = this.expandRelative();
        coords.forEach((coord) => {
            coord.x += this.origin.x;
            coord.y += this.origin.y;
            coord.z += this.origin.z;
        });

        return coords;
    }

    public abstract expandRelative(this: CompressedLayerData): Point3[];
}

export class CompressedLayerDataField extends CompressedLayerData {
    public readonly format = false;
    public readonly field: Field3;

    constructor(origin: Point3, field: Field3) {
        const fourbit = field.length.x >= 8 || field.length.y >= 8 || field.length.z >= 8;
        super(fourbit, origin);
        this.field = field;
    }

    public static compress(origin: Point3, length: Point3, coords: Point3[]): CompressedLayerDataField {
        const field: Field3 = new Field3(length);
        coords.forEach((coord) => {
            field.xyz[coord.x][coord.y][coord.z] = true;
        });

        return new CompressedLayerDataField(origin, field);
    }

    public static fromBufferWithOrigin(
        buffer: ReadingBitBuffer,
        coordinateBitSize: number,
        origin: Point3
    ): CompressedLayerDataField {
        const length = new Point3(
            buffer.readUIntBitsBE(coordinateBitSize),
            buffer.readUIntBitsBE(coordinateBitSize),
            buffer.readUIntBitsBE(coordinateBitSize)
        );

        const field = new Field3(length);
        for (let x = 0; x < field.length.x; x++) {
            for (let y = 0; y < field.length.y; y++) {
                for (let z = 0; z < field.length.z; z++) {
                    field.xyz[x][y][z] = buffer.readUIntBitsBE(BITS.FIELD_FLAG) > 0;
                }
            }
        }
        return new CompressedLayerDataField(origin, field);
    }

    public compressedSizeInBits(this: CompressedLayerDataField): number {
        let size = super.compressedSizeInBits();
        size += 3 * this.coordinateBitSize();
        size += this.field.length.x * this.field.length.y * this.field.length.z * BITS.FIELD_FLAG;
        return size;
    }

    public toBuffer(this: CompressedLayerDataField, buffer: WritingBitBuffer): void {
        super.toBuffer(buffer);
        const coordinateBitSize = this.coordinateBitSize();
        buffer.writeUIntBitsBE(coordinateBitSize, this.field.length.x);
        buffer.writeUIntBitsBE(coordinateBitSize, this.field.length.y);
        buffer.writeUIntBitsBE(coordinateBitSize, this.field.length.z);

        for (let x = 0; x < this.field.length.x; x++) {
            for (let y = 0; y < this.field.length.y; y++) {
                for (let z = 0; z < this.field.length.z; z++) {
                    buffer.writeUIntBitsBE(BITS.FIELD_FLAG, this.field.xyz[x][y][z] ? 1 : 0);
                }
            }
        }
    }

    expandRelative(): Point3[] {
        const coords: Point3[] = [];
        for (let x = 0; x < this.field.length.x; x++) {
            for (let y = 0; y < this.field.length.y; y++) {
                for (let z = 0; z < this.field.length.z; z++) {
                    if (this.field.xyz[x][y][z]) {
                        coords.push(new Point3(x, y, z));
                    }
                }
            }
        }

        return coords;
    }
}

export class CompressedLayerDataList extends CompressedLayerData {
    public static DIRECTION_XYZ = 0;
    public static DIRECTION_YZ = 1;
    public static DIRECTION_XZ = 2;
    public static DIRECTION_XY = 3;

    public readonly format = true;
    public readonly direction: number; // 0: 3d, 1: yz, 2: xz, 3: xy
    public readonly coords: Point2[] | Point3[];

    constructor(origin: Point3, direction: number, coords: Point2[] | Point3[]) {
        const fourbit = coords.some((coord) => coord.x > 8 || coord.y > 8 || (coord instanceof Point3 && coord.z > 8));
        super(fourbit, origin);
        this.direction = direction;
        this.coords = coords;
    }

    public static compress(origin: Point3, length: Point3, coords: Point3[]): CompressedLayerDataList {
        let direction;
        let list: Point2[] | Point3[];
        if (length.x === 1) {
            direction = CompressedLayerDataList.DIRECTION_YZ;
            list = coords.map((coord) => new Point2(coord.y, coord.z));
        } else if (length.y === 1) {
            direction = CompressedLayerDataList.DIRECTION_XZ;
            list = coords.map((coord) => new Point2(coord.x, coord.z));
        } else if (length.z === 1) {
            direction = CompressedLayerDataList.DIRECTION_XY;
            list = coords.map((coord) => new Point2(coord.x, coord.y));
        } else {
            direction = CompressedLayerDataList.DIRECTION_XYZ;
            list = coords;
        }

        return new CompressedLayerDataList(origin, direction, list);
    }

    public static fromBufferWithOrigin(
        buffer: ReadingBitBuffer,
        coordinateBitSize: number,
        origin: Point3
    ): CompressedLayerDataList {
        const direction = buffer.readUIntBitsBE(BITS.DIRECTION);
        const length = buffer.readUIntBitsBE(BITS.LAYER_LIST_COUNT) + 1;
        const coords: (Point2 | Point3)[] = [];

        if (direction === CompressedLayerDataList.DIRECTION_XYZ) {
            for (let i = 0; i < length; i++) {
                coords.push(
                    new Point3(
                        buffer.readUIntBitsBE(coordinateBitSize),
                        buffer.readUIntBitsBE(coordinateBitSize),
                        buffer.readUIntBitsBE(coordinateBitSize)
                    )
                );
            }
        } else {
            for (let i = 0; i < length; i++) {
                coords.push(
                    new Point2(buffer.readUIntBitsBE(coordinateBitSize), buffer.readUIntBitsBE(coordinateBitSize))
                );
            }
        }

        return new CompressedLayerDataList(origin, direction, coords);
    }

    public overflow(this: CompressedLayerDataList): boolean {
        return this.coords.length > Math.pow(2, BITS.LAYER_LIST_COUNT + 1) - 1;
    }

    public compressedSizeInBits(this: CompressedLayerDataList): number {
        let size = super.compressedSizeInBits();
        size += BITS.DIRECTION;
        size += BITS.LAYER_LIST_COUNT;
        size += this.coords.length * this.coordinateBitSize() * (this.direction === 0 ? 3 : 2);
        return size;
    }

    public toBuffer(buffer: WritingBitBuffer): void {
        super.toBuffer(buffer);
        const coordinateBitSize = this.coordinateBitSize();
        buffer.writeUIntBitsBE(BITS.DIRECTION, this.direction);
        if (this.coords.length < 1) {
            throw new Error('LayerDataList must have at least one coordinate');
        }
        buffer.writeUIntBitsBE(BITS.LAYER_LIST_COUNT, this.coords.length - 1);

        this.coords.forEach((coord) => {
            buffer.writeUIntBitsBE(coordinateBitSize, coord.x);
            buffer.writeUIntBitsBE(coordinateBitSize, coord.y);
            if (coord instanceof Point3) {
                buffer.writeUIntBitsBE(coordinateBitSize, coord.z);
            }
        });
    }

    public expandRelative(): Point3[] {
        let coords: Point3[];
        if (this.direction === CompressedLayerDataList.DIRECTION_YZ) {
            coords = this.coords.map((coord) => new Point3(0, coord.x, coord.y));
        } else if (this.direction === CompressedLayerDataList.DIRECTION_XZ) {
            coords = this.coords.map((coord) => new Point3(coord.x, 0, coord.y));
        } else if (this.direction === CompressedLayerDataList.DIRECTION_XY) {
            coords = this.coords.map((coord) => new Point3(coord.x, coord.y, 0));
        } else {
            coords = this.coords.map((coord) => new Point3(coord.x, coord.y, (coord as Point3).z));
        }

        return coords;
    }
}

export type CompressedMaterial = {
    color: number;
    shader: number;
};

export class CompressedColor {
    public readonly r: number;
    public readonly g: number;
    public readonly b: number;

    constructor(r: number, g: number, b: number) {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    public eq(this: CompressedColor, other: CompressedColor): boolean {
        return this.r === other.r && this.g === other.g && this.b === other.b;
    }
}

export class CompressedBot {
    public readonly name: string;
    public readonly anchor: [number, number, number];
    public readonly materials: CompressedMaterial[];
    public readonly layers: CompressedLayer[];

    constructor(
        name: string,
        anchor: [number, number, number],
        materials: CompressedMaterial[],
        layers: CompressedLayer[]
    ) {
        this.name = name;
        this.anchor = anchor;
        this.materials = materials;
        this.layers = layers;
    }

    public static compress(
        bot: OnlyBot,
        compressMaterial: (material: OnlyBotMaterial) => CompressedMaterial
    ): CompressedBot {
        const materials = bot.materials.map(compressMaterial);
        const layers = bot.layers.map((layer) => CompressedLayer.compress(layer));

        return new CompressedBot(bot.name, [bot.anchor.x, bot.anchor.y, bot.anchor.z], materials, layers);
    }

    public static fromBuffer(buffer: ReadingBitBuffer): CompressedBot {
        const nameLength = buffer.readUIntBitsBE(BITS.NAME_COUNT) + 1;
        const nameBuffer = Buffer.alloc(nameLength);
        for (let i = 0; i < nameLength; i++) {
            nameBuffer.writeUInt8(mapBitsToAscii(buffer.readUIntBitsBE(BITS.NAME_CHAR)), i);
        }
        const name = nameBuffer.toString('ascii');

        const anchor: [number, number, number] = [
            (buffer.readUIntBitsBE(BITS.ANCHOR_XZ_SIGN) === 0 ? -1 : 1) * buffer.readUIntBitsBE(BITS.ANCHOR_X),
            buffer.readUIntBitsBE(BITS.ANCHOR_Y),
            (buffer.readUIntBitsBE(BITS.ANCHOR_XZ_SIGN) === 0 ? -1 : 1) * buffer.readUIntBitsBE(BITS.ANCHOR_Z),
        ];
        const materialCount = buffer.readUIntBitsBE(BITS.MATERIAL_COUNT) + 1;
        const materials: CompressedMaterial[] = [];
        for (let i = 0; i < materialCount; i++) {
            const color = buffer.readUIntBitsBE(BITS.MATERIAL_COLOR);
            const shader = buffer.readUIntBitsBE(BITS.MATERIAL_SHADER);
            materials.push({ color, shader });
        }
        const layerCount = buffer.readUIntBitsBE(BITS.LAYER_COUNT) + 1;
        const layers: CompressedLayer[] = [];
        for (let i = 0; i < layerCount; i++) {
            layers.push(CompressedLayer.fromBuffer(buffer));
        }
        return new CompressedBot(name, anchor, materials, layers);
    }

    public compressedSizeInBits(this: CompressedBot): number {
        let size = 0;
        size += BITS.NAME_COUNT;
        size += this.name.length * BITS.NAME_CHAR;
        size += BITS.ANCHOR_XZ_SIGN;
        size += BITS.ANCHOR_X;
        size += BITS.ANCHOR_Y;
        size += BITS.ANCHOR_XZ_SIGN;
        size += BITS.ANCHOR_Z;
        size += BITS.MATERIAL_COUNT;
        size += this.materials.length * (BITS.MATERIAL_COLOR + BITS.MATERIAL_SHADER);
        size += BITS.LAYER_COUNT;
        size += this.layers.reduce((sum, layer) => sum + layer.compressedSizeInBits(), 0);
        return size;
    }

    public toBuffer(this: CompressedBot, buffer: WritingBitBuffer): void {
        if (this.name.length < 1) {
            throw new Error('Name must be at least one character long');
        }
        buffer.writeUIntBitsBE(BITS.NAME_COUNT, this.name.length - 1);
        [...Buffer.from(this.name, 'ascii')].forEach((c) => {
            buffer.writeUIntBitsBE(BITS.NAME_CHAR, mapAsciiToBits(c));
        });
        buffer.writeUIntBitsBE(BITS.ANCHOR_XZ_SIGN, this.anchor[0] < 0 ? 0 : 1);
        buffer.writeUIntBitsBE(BITS.ANCHOR_X, Math.abs(this.anchor[0]));
        buffer.writeUIntBitsBE(BITS.ANCHOR_Y, this.anchor[1]);
        buffer.writeUIntBitsBE(BITS.ANCHOR_XZ_SIGN, this.anchor[2] < 0 ? 0 : 1);
        buffer.writeUIntBitsBE(BITS.ANCHOR_Z, Math.abs(this.anchor[2]));
        if (this.materials.length < 1) {
            throw new Error('Must have at least one material');
        }
        buffer.writeUIntBitsBE(BITS.MATERIAL_COUNT, this.materials.length - 1);
        this.materials.forEach((material) => {
            buffer.writeUIntBitsBE(BITS.MATERIAL_COLOR, material.color);
            buffer.writeUIntBitsBE(BITS.MATERIAL_SHADER, material.shader);
        });
        if (this.layers.length < 1) {
            throw new Error('Must have at least one layer');
        }
        buffer.writeUIntBitsBE(BITS.LAYER_COUNT, this.layers.length - 1);
        this.layers.forEach((layer) => {
            layer.toBuffer(buffer);
        });
    }

    public expand(this: CompressedBot, colors: CompressedColor[]): OnlyBot {
        const materials = this.materials.map<OnlyBotMaterial>((material) => {
            const { r, g, b } = colors[material.color];
            return {
                color: [r, g, b],
                shader: material.shader,
            };
        });
        const layers = this.layers.map((layer) => layer.expand());

        return new OnlyBot(this.name, { x: this.anchor[0], y: this.anchor[1], z: this.anchor[2] }, materials, layers);
    }
}

export class CompressedBots {
    public readonly colors: CompressedColor[];
    public readonly bots: CompressedBot[];

    constructor(colors: CompressedColor[], bots: CompressedBot[]) {
        this.colors = colors;
        this.bots = bots;
    }

    public static compress(bots: OnlyBot[]): CompressedBots {
        const colors: CompressedColor[] = [];
        const compressMaterial = (material: OnlyBotMaterial): CompressedMaterial => {
            const [r, g, b] = material.color;
            const color = new CompressedColor(r, g, b);
            const existing = colors.findIndex((c) => c.eq(color));
            if (existing < 0) {
                colors.push(color);
            }

            return {
                color: existing < 0 ? colors.length - 1 : existing,
                shader: material.shader,
            };
        };
        const compressedBots: CompressedBot[] = bots.map((bot) => CompressedBot.compress(bot, compressMaterial));

        return new CompressedBots(colors, compressedBots);
    }

    public static fromBuffer(rawBuffer: Buffer): CompressedBots {
        const buffer = new ReadingBitBuffer(rawBuffer);
        const colorCount = buffer.readUIntBitsBE(BITS.COLOR_COUNT) + 1;
        const colors = [];
        for (let i = 0; i < colorCount; i++) {
            colors.push(
                new CompressedColor(
                    buffer.readUIntBitsBE(BITS.COLOR_RGB),
                    buffer.readUIntBitsBE(BITS.COLOR_RGB),
                    buffer.readUIntBitsBE(BITS.COLOR_RGB)
                )
            );
        }
        const bots = [];
        while (buffer.hasRemaining(BITS.BOT_LENGTH)) {
            const length = buffer.readUIntBitsBE(BITS.BOT_LENGTH);
            if (length === 0) {
                continue;
            }

            bots.push(CompressedBot.fromBuffer(buffer));
        }

        return new CompressedBots(colors, bots);
    }

    public compressedSizeInBits(this: CompressedBots): number {
        let size = 0;
        size += BITS.COLOR_COUNT;
        size += this.colors.length * (BITS.COLOR_RGB * 3);

        size += this.bots.length * BITS.BOT_LENGTH;
        size += this.bots.reduce((sum, bot) => sum + bot.compressedSizeInBits(), 0);
        return size;
    }

    public toBuffer(this: CompressedBots): Buffer {
        const buffer = new WritingBitBuffer(this.compressedSizeInBits());
        if (this.colors.length < 1) {
            throw new Error('No colors');
        }
        buffer.writeUIntBitsBE(BITS.COLOR_COUNT, this.colors.length - 1);
        this.colors.forEach(({ r, g, b }) => {
            buffer.writeUIntBitsBE(BITS.COLOR_RGB, r);
            buffer.writeUIntBitsBE(BITS.COLOR_RGB, g);
            buffer.writeUIntBitsBE(BITS.COLOR_RGB, b);
        });
        this.bots.forEach((bot) => {
            buffer.writeUIntBitsBE(BITS.BOT_LENGTH, bot.compressedSizeInBits());
            bot.toBuffer(buffer);
        });

        return buffer.end();
    }

    public expand(this: CompressedBots): OnlyBot[] {
        return this.bots.map((bot) => bot.expand(this.colors));
    }
}
