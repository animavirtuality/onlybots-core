import { Point2, Point3, Point3Set } from '@/point';
import { OnlyBot, OnlyBotLayer, OnlyBotMaterial } from '@/bot';
import { mapAsciiToBits, mapBitsToAscii, ReadingBitBuffer, WritingBitBuffer } from '@/bits';
import { calculateVoxelBounds, packVoxelSpace } from '@/utils';

const BIT_LENGTH = {
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
        if (layer.voxels.length < 1) {
            throw new Error('Layer has no voxels!');
        }
        // clone the points because we're about to pack them
        const voxels = layer.voxels.map((voxel) => voxel.clone());
        const origin = calculateVoxelBounds(voxels).min;

        const max = packVoxelSpace(voxels);
        const length = max.toLength();

        return new CompressedLayer(layer.type, layer.material, CompressedLayerData.compress(origin, length, voxels));
    }

    public static fromBuffer(buffer: ReadingBitBuffer): CompressedLayer {
        const type = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_TYPE);
        const material = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_MATERIAL);
        const data = CompressedLayerData.fromBuffer(buffer);

        return new CompressedLayer(type, material, data);
    }

    public compressedSizeInBits(this: CompressedLayer): number {
        let size = 0;
        size += BIT_LENGTH.LAYER_TYPE;
        size += BIT_LENGTH.LAYER_MATERIAL;
        size += this.data.compressedSizeInBits();
        return size;
    }

    public toBuffer(this: CompressedLayer, buffer: WritingBitBuffer): void {
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_TYPE, this.type);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_MATERIAL, this.material);
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

    public static compress(origin: Point3, length: Point3, voxels: Point3[]): CompressedLayerData {
        const dataField = CompressedLayerDataField.compress(origin, length, voxels);
        const dataList = CompressedLayerDataList.compress(origin, length, voxels);

        return dataList.overflow() || dataField.compressedSizeInBits() < dataList.compressedSizeInBits()
            ? dataField
            : dataList;
    }

    public static fromBuffer(buffer: ReadingBitBuffer): CompressedLayerData {
        const coordinateBitSize = buffer.readUIntBitsBE(BIT_LENGTH.FOURBIT_FLAG) > 0 ? 4 : 3;
        const origin = new Point3(
            buffer.readUIntBitsBE(BIT_LENGTH.ORIGIN),
            buffer.readUIntBitsBE(BIT_LENGTH.ORIGIN),
            buffer.readUIntBitsBE(BIT_LENGTH.ORIGIN)
        );
        const format = buffer.readUIntBitsBE(BIT_LENGTH.FORMAT_FLAG);

        return format
            ? CompressedLayerDataList.fromBufferWithOrigin(buffer, coordinateBitSize, origin)
            : CompressedLayerDataField.fromBufferWithOrigin(buffer, coordinateBitSize, origin);
    }

    protected coordinateBitSize(this: CompressedLayerData): number {
        return this.fourbit ? 4 : 3;
    }

    public compressedSizeInBits(): number {
        let size = 0;
        size += BIT_LENGTH.FOURBIT_FLAG;
        size += 3 * BIT_LENGTH.ORIGIN;
        size += BIT_LENGTH.FORMAT_FLAG;
        return size;
    }

    public toBuffer(buffer: WritingBitBuffer): void {
        buffer.writeUIntBitsBE(BIT_LENGTH.FOURBIT_FLAG, this.fourbit ? 1 : 0);
        buffer.writeUIntBitsBE(BIT_LENGTH.ORIGIN, this.origin.x);
        buffer.writeUIntBitsBE(BIT_LENGTH.ORIGIN, this.origin.y);
        buffer.writeUIntBitsBE(BIT_LENGTH.ORIGIN, this.origin.z);
        buffer.writeUIntBitsBE(BIT_LENGTH.FORMAT_FLAG, this.format ? 1 : 0);
    }

    public expand(this: CompressedLayerData): Point3[] {
        const voxels = this.expandRelative();
        voxels.forEach((voxel) => {
            voxel.x += this.origin.x;
            voxel.y += this.origin.y;
            voxel.z += this.origin.z;
        });

        return voxels;
    }

    public abstract expandRelative(this: CompressedLayerData): Point3[];
}

export class CompressedLayerDataField extends CompressedLayerData {
    public readonly format = false;
    public readonly length: Point3;
    public readonly set: Point3Set;

    constructor(origin: Point3, length: Point3, set: Point3Set) {
        const fourbit = length.x >= 8 || length.y >= 8 || length.z >= 8;
        super(fourbit, origin);
        this.length = length;
        this.set = set;
    }

    public static compress(origin: Point3, length: Point3, voxels: Point3[]): CompressedLayerDataField {
        const set = new Point3Set();
        voxels.forEach((voxel) => {
            set.addPoint(voxel);
        });

        return new CompressedLayerDataField(origin, length, set);
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

        const set = new Point3Set();
        for (let x = 0; x < length.x; x++) {
            for (let y = 0; y < length.y; y++) {
                for (let z = 0; z < length.z; z++) {
                    if (buffer.readUIntBitsBE(BIT_LENGTH.FIELD_FLAG) > 0) {
                        set.add(x, y, z);
                    }
                }
            }
        }
        return new CompressedLayerDataField(origin, length, set);
    }

    public compressedSizeInBits(this: CompressedLayerDataField): number {
        let size = super.compressedSizeInBits();
        size += 3 * this.coordinateBitSize();
        size += this.length.x * this.length.y * this.length.z * BIT_LENGTH.FIELD_FLAG;
        return size;
    }

    public toBuffer(this: CompressedLayerDataField, buffer: WritingBitBuffer): void {
        super.toBuffer(buffer);
        const coordinateBitSize = this.coordinateBitSize();
        buffer.writeUIntBitsBE(coordinateBitSize, this.length.x);
        buffer.writeUIntBitsBE(coordinateBitSize, this.length.y);
        buffer.writeUIntBitsBE(coordinateBitSize, this.length.z);

        for (let x = 0; x < this.length.x; x++) {
            for (let y = 0; y < this.length.y; y++) {
                for (let z = 0; z < this.length.z; z++) {
                    buffer.writeUIntBitsBE(BIT_LENGTH.FIELD_FLAG, this.set.has(x, y, z) ? 1 : 0);
                }
            }
        }
    }

    expandRelative(): Point3[] {
        const voxels: Point3[] = [];
        for (let x = 0; x < this.length.x; x++) {
            for (let y = 0; y < this.length.y; y++) {
                for (let z = 0; z < this.length.z; z++) {
                    const point = new Point3(x, y, z);
                    if (this.set.hasPoint(point)) {
                        voxels.push(point);
                    }
                }
            }
        }

        return voxels;
    }
}

export class CompressedLayerDataList extends CompressedLayerData {
    public static DIRECTION_XYZ = 0;
    public static DIRECTION_YZ = 1;
    public static DIRECTION_XZ = 2;
    public static DIRECTION_XY = 3;

    public readonly format = true;
    public readonly direction: number; // 0: 3d, 1: yz, 2: xz, 3: xy
    public readonly voxels: Point2[] | Point3[];

    constructor(origin: Point3, direction: number, voxels: Point2[] | Point3[]) {
        const fourbit = voxels.some((voxel) => voxel.x > 8 || voxel.y > 8 || (voxel instanceof Point3 && voxel.z > 8));
        super(fourbit, origin);
        this.direction = direction;
        this.voxels = voxels;
    }

    public static compress(origin: Point3, length: Point3, voxels: Point3[]): CompressedLayerDataList {
        let direction;
        let list: Point2[] | Point3[];
        if (length.x === 1) {
            direction = CompressedLayerDataList.DIRECTION_YZ;
            list = voxels.map((voxel) => new Point2(voxel.y, voxel.z));
        } else if (length.y === 1) {
            direction = CompressedLayerDataList.DIRECTION_XZ;
            list = voxels.map((voxel) => new Point2(voxel.x, voxel.z));
        } else if (length.z === 1) {
            direction = CompressedLayerDataList.DIRECTION_XY;
            list = voxels.map((voxel) => new Point2(voxel.x, voxel.y));
        } else {
            direction = CompressedLayerDataList.DIRECTION_XYZ;
            list = voxels;
        }

        return new CompressedLayerDataList(origin, direction, list);
    }

    public static fromBufferWithOrigin(
        buffer: ReadingBitBuffer,
        coordinateBitSize: number,
        origin: Point3
    ): CompressedLayerDataList {
        const direction = buffer.readUIntBitsBE(BIT_LENGTH.DIRECTION);
        const length = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_LIST_COUNT) + 1;
        const voxels: (Point2 | Point3)[] = [];

        if (direction === CompressedLayerDataList.DIRECTION_XYZ) {
            for (let i = 0; i < length; i++) {
                voxels.push(
                    new Point3(
                        buffer.readUIntBitsBE(coordinateBitSize),
                        buffer.readUIntBitsBE(coordinateBitSize),
                        buffer.readUIntBitsBE(coordinateBitSize)
                    )
                );
            }
        } else {
            for (let i = 0; i < length; i++) {
                voxels.push(
                    new Point2(buffer.readUIntBitsBE(coordinateBitSize), buffer.readUIntBitsBE(coordinateBitSize))
                );
            }
        }

        return new CompressedLayerDataList(origin, direction, voxels);
    }

    public overflow(this: CompressedLayerDataList): boolean {
        return this.voxels.length > Math.pow(2, BIT_LENGTH.LAYER_LIST_COUNT + 1) - 1;
    }

    public compressedSizeInBits(this: CompressedLayerDataList): number {
        let size = super.compressedSizeInBits();
        size += BIT_LENGTH.DIRECTION;
        size += BIT_LENGTH.LAYER_LIST_COUNT;
        size += this.voxels.length * this.coordinateBitSize() * (this.direction === 0 ? 3 : 2);
        return size;
    }

    public toBuffer(buffer: WritingBitBuffer): void {
        super.toBuffer(buffer);
        const coordinateBitSize = this.coordinateBitSize();
        buffer.writeUIntBitsBE(BIT_LENGTH.DIRECTION, this.direction);
        if (this.voxels.length < 1) {
            throw new Error('LayerDataList must have at least one voxel');
        }
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_LIST_COUNT, this.voxels.length - 1);

        this.voxels.forEach((voxels) => {
            buffer.writeUIntBitsBE(coordinateBitSize, voxels.x);
            buffer.writeUIntBitsBE(coordinateBitSize, voxels.y);
            if (voxels instanceof Point3) {
                buffer.writeUIntBitsBE(coordinateBitSize, voxels.z);
            }
        });
    }

    public expandRelative(): Point3[] {
        let voxels: Point3[];
        if (this.direction === CompressedLayerDataList.DIRECTION_YZ) {
            voxels = this.voxels.map((voxel) => new Point3(0, voxel.x, voxel.y));
        } else if (this.direction === CompressedLayerDataList.DIRECTION_XZ) {
            voxels = this.voxels.map((voxel) => new Point3(voxel.x, 0, voxel.y));
        } else if (this.direction === CompressedLayerDataList.DIRECTION_XY) {
            voxels = this.voxels.map((voxel) => new Point3(voxel.x, voxel.y, 0));
        } else {
            voxels = this.voxels.map((voxel) => new Point3(voxel.x, voxel.y, (voxel as Point3).z));
        }

        return voxels;
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
        const nameLength = buffer.readUIntBitsBE(BIT_LENGTH.NAME_COUNT) + 1;
        const nameBuffer = Buffer.alloc(nameLength);
        for (let i = 0; i < nameLength; i++) {
            nameBuffer.writeUInt8(mapBitsToAscii(buffer.readUIntBitsBE(BIT_LENGTH.NAME_CHAR)), i);
        }
        const name = nameBuffer.toString('ascii');

        const anchor: [number, number, number] = [
            (buffer.readUIntBitsBE(BIT_LENGTH.ANCHOR_XZ_SIGN) === 0 ? -1 : 1) *
                buffer.readUIntBitsBE(BIT_LENGTH.ANCHOR_X),
            buffer.readUIntBitsBE(BIT_LENGTH.ANCHOR_Y),
            (buffer.readUIntBitsBE(BIT_LENGTH.ANCHOR_XZ_SIGN) === 0 ? -1 : 1) *
                buffer.readUIntBitsBE(BIT_LENGTH.ANCHOR_Z),
        ];
        const materialCount = buffer.readUIntBitsBE(BIT_LENGTH.MATERIAL_COUNT) + 1;
        const materials: CompressedMaterial[] = [];
        for (let i = 0; i < materialCount; i++) {
            const color = buffer.readUIntBitsBE(BIT_LENGTH.MATERIAL_COLOR);
            const shader = buffer.readUIntBitsBE(BIT_LENGTH.MATERIAL_SHADER);
            materials.push({ color, shader });
        }
        const layerCount = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_COUNT) + 1;
        const layers: CompressedLayer[] = [];
        for (let i = 0; i < layerCount; i++) {
            layers.push(CompressedLayer.fromBuffer(buffer));
        }
        return new CompressedBot(name, anchor, materials, layers);
    }

    public compressedSizeInBits(this: CompressedBot): number {
        let size = 0;
        size += BIT_LENGTH.NAME_COUNT;
        size += this.name.length * BIT_LENGTH.NAME_CHAR;
        size += BIT_LENGTH.ANCHOR_XZ_SIGN;
        size += BIT_LENGTH.ANCHOR_X;
        size += BIT_LENGTH.ANCHOR_Y;
        size += BIT_LENGTH.ANCHOR_XZ_SIGN;
        size += BIT_LENGTH.ANCHOR_Z;
        size += BIT_LENGTH.MATERIAL_COUNT;
        size += this.materials.length * (BIT_LENGTH.MATERIAL_COLOR + BIT_LENGTH.MATERIAL_SHADER);
        size += BIT_LENGTH.LAYER_COUNT;
        size += this.layers.reduce((sum, layer) => sum + layer.compressedSizeInBits(), 0);
        return size;
    }

    public toBuffer(this: CompressedBot, buffer: WritingBitBuffer): void {
        if (this.name.length < 1) {
            throw new Error('Name must be at least one character long');
        }
        buffer.writeUIntBitsBE(BIT_LENGTH.NAME_COUNT, this.name.length - 1);
        [...Buffer.from(this.name, 'ascii')].forEach((c) => {
            buffer.writeUIntBitsBE(BIT_LENGTH.NAME_CHAR, mapAsciiToBits(c));
        });
        buffer.writeUIntBitsBE(BIT_LENGTH.ANCHOR_XZ_SIGN, this.anchor[0] < 0 ? 0 : 1);
        buffer.writeUIntBitsBE(BIT_LENGTH.ANCHOR_X, Math.abs(this.anchor[0]));
        buffer.writeUIntBitsBE(BIT_LENGTH.ANCHOR_Y, this.anchor[1]);
        buffer.writeUIntBitsBE(BIT_LENGTH.ANCHOR_XZ_SIGN, this.anchor[2] < 0 ? 0 : 1);
        buffer.writeUIntBitsBE(BIT_LENGTH.ANCHOR_Z, Math.abs(this.anchor[2]));
        if (this.materials.length < 1) {
            throw new Error('Must have at least one material');
        }
        buffer.writeUIntBitsBE(BIT_LENGTH.MATERIAL_COUNT, this.materials.length - 1);
        this.materials.forEach((material) => {
            buffer.writeUIntBitsBE(BIT_LENGTH.MATERIAL_COLOR, material.color);
            buffer.writeUIntBitsBE(BIT_LENGTH.MATERIAL_SHADER, material.shader);
        });
        if (this.layers.length < 1) {
            throw new Error('Must have at least one layer');
        }
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_COUNT, this.layers.length - 1);
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
    public static readonly BIT_LENGTH = BIT_LENGTH;
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
        const colorCount = buffer.readUIntBitsBE(BIT_LENGTH.COLOR_COUNT) + 1;
        const colors = [];
        for (let i = 0; i < colorCount; i++) {
            colors.push(
                new CompressedColor(
                    buffer.readUIntBitsBE(BIT_LENGTH.COLOR_RGB),
                    buffer.readUIntBitsBE(BIT_LENGTH.COLOR_RGB),
                    buffer.readUIntBitsBE(BIT_LENGTH.COLOR_RGB)
                )
            );
        }
        const bots = [];
        while (buffer.hasRemaining(BIT_LENGTH.BOT_LENGTH)) {
            const length = buffer.readUIntBitsBE(BIT_LENGTH.BOT_LENGTH);
            if (length === 0) {
                continue;
            }

            bots.push(CompressedBot.fromBuffer(buffer));
        }

        return new CompressedBots(colors, bots);
    }

    public compressedSizeInBits(this: CompressedBots): number {
        let size = 0;
        size += BIT_LENGTH.COLOR_COUNT;
        size += this.colors.length * (BIT_LENGTH.COLOR_RGB * 3);

        size += this.bots.length * BIT_LENGTH.BOT_LENGTH;
        size += this.bots.reduce((sum, bot) => sum + bot.compressedSizeInBits(), 0);
        return size;
    }

    public toBuffer(this: CompressedBots): Buffer {
        const buffer = new WritingBitBuffer(this.compressedSizeInBits());
        if (this.colors.length < 1) {
            throw new Error('No colors');
        }
        buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_COUNT, this.colors.length - 1);
        this.colors.forEach(({ r, g, b }) => {
            buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_RGB, r);
            buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_RGB, g);
            buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_RGB, b);
        });
        this.bots.forEach((bot) => {
            buffer.writeUIntBitsBE(BIT_LENGTH.BOT_LENGTH, bot.compressedSizeInBits());
            bot.toBuffer(buffer);
        });

        return buffer.end();
    }

    public expand(this: CompressedBots): OnlyBot[] {
        return this.bots.map((bot) => bot.expand(this.colors));
    }
}
