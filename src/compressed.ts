import { Point2, Point3, Point3Set } from '@/point';
import { OnlyBot, OnlyBotLayer, OnlyBotMaterial } from '@/bot';
import { mapAsciiToBits, mapBitsToAscii, ReadingBitBuffer, WritingBitBuffer } from '@/bits';
import { calculateVoxelBounds, packVoxelSpace } from '@/utils';

const BIT_LENGTH = {
    COLOR_COUNT_BITWIDTH: 4,
    COLOR_RGB: 8,
    BOT_LENGTH: 16,
    NAME_COUNT: 5,
    NAME_CHAR: 5,
    ANCHOR_XZ_SIGN: 1,
    ANCHOR_X: 4,
    ANCHOR_Y: 3,
    ANCHOR_Z: 4,
    MATERIAL_COUNT: 2,
    MATERIAL_SHADER: 8,
    LAYER_VOXEL_LIST_COUNT_BITWIDTH: 4,
    LAYER_COUNT: 5,
    LAYER_TYPE: 3,
    LAYER_MATERIAL: 2,
    LAYER_VOXEL_ORIGIN: 4,
    LAYER_VOXEL_FORMAT: 1,
    LAYER_VOXEL_FIELD_LENGTH: 4,
    LAYER_VOXEL_FIELD_FLAG: 1,
    LAYER_VOXEL_LIST_FOURBIT: 1,
    LAYER_VOXEL_LIST_DIRECTION: 2,
};

const minBitsRequired = (n: number): number => {
    if (isNaN(n) || n < 0) {
        throw new Error(`Cannot calculate bits required for: ${n}`);
    }

    if (n < 1) {
        return 1;
    }

    // Formula for max int with b bits is 2^b - 1
    // This means that, for example, 1 bit can store [0, 1] and 2 bits can store [0, 3]
    // However, Math.log2(2) = 1, so we need to add 1 to n to get the correct result
    return Math.ceil(Math.log2(n + 1));
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

    public static compress(layer: OnlyBotLayer, data: CompressedLayerData): CompressedLayer {
        return new CompressedLayer(layer.type, layer.material, data);
    }

    public static fromBuffer(buffer: ReadingBitBuffer, layerListCountBitwidth: number): CompressedLayer {
        const type = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_TYPE);
        const material = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_MATERIAL);
        const data = CompressedLayerData.fromBuffer(buffer, layerListCountBitwidth);

        return new CompressedLayer(type, material, data);
    }

    public compressedSizeInBits(this: CompressedLayer, layerListCountBitwidth: number): number {
        let size = 0;
        size += BIT_LENGTH.LAYER_TYPE;
        size += BIT_LENGTH.LAYER_MATERIAL;
        size += this.data.compressedSizeInBits(layerListCountBitwidth);
        return size;
    }

    public toBuffer(this: CompressedLayer, buffer: WritingBitBuffer, layerListCountBitwidth: number): void {
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_TYPE, this.type);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_MATERIAL, this.material);
        this.data.toBuffer(buffer, layerListCountBitwidth);
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
    public readonly origin: Point3;
    public abstract readonly format: boolean;

    protected constructor(origin: Point3) {
        this.origin = origin;
    }

    public static fromBuffer(buffer: ReadingBitBuffer, layerListCountBitwidth: number): CompressedLayerData {
        const origin = new Point3(
            buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_ORIGIN),
            buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_ORIGIN),
            buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_ORIGIN)
        );
        const format = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FORMAT);

        return format
            ? CompressedLayerDataList.formatSpecificFromBuffer(buffer, origin, layerListCountBitwidth)
            : CompressedLayerDataField.formatSpecificFromBuffer(buffer, origin);
    }

    protected abstract formatSpecificCompressedSizeInBits(layerListCountBitwidth: number): number;

    public compressedSizeInBits(this: CompressedLayerData, layerListCountBitwidth: number): number {
        let size = 0;
        size += 3 * BIT_LENGTH.LAYER_VOXEL_ORIGIN;
        size += BIT_LENGTH.LAYER_VOXEL_FORMAT;
        size += this.formatSpecificCompressedSizeInBits(layerListCountBitwidth);
        return size;
    }

    protected abstract formatSpecificToBuffer(buffer: WritingBitBuffer, layerListCountBitwidth: number): void;

    public toBuffer(this: CompressedLayerData, buffer: WritingBitBuffer, layerListCountBitwidth: number): void {
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_ORIGIN, this.origin.x);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_ORIGIN, this.origin.y);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_ORIGIN, this.origin.z);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FORMAT, this.format ? 1 : 0);
        this.formatSpecificToBuffer(buffer, layerListCountBitwidth);
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
        super(origin);
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

    public static formatSpecificFromBuffer(buffer: ReadingBitBuffer, origin: Point3): CompressedLayerDataField {
        const length = new Point3(
            buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_LENGTH) + 1,
            buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_LENGTH) + 1,
            buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_LENGTH) + 1
        );

        const set = new Point3Set();
        for (let x = 0; x < length.x; x++) {
            for (let y = 0; y < length.y; y++) {
                for (let z = 0; z < length.z; z++) {
                    if (buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_FLAG) > 0) {
                        set.add(x, y, z);
                    }
                }
            }
        }
        return new CompressedLayerDataField(origin, length, set);
    }

    protected formatSpecificCompressedSizeInBits(
        this: CompressedLayerDataField,
        _layerListCountBitwidth: number
    ): number {
        let size = 0;
        size += 3 * BIT_LENGTH.LAYER_VOXEL_FIELD_LENGTH;
        size += this.length.x * this.length.y * this.length.z * BIT_LENGTH.LAYER_VOXEL_FIELD_FLAG;
        return size;
    }

    protected formatSpecificToBuffer(
        this: CompressedLayerDataField,
        buffer: WritingBitBuffer,
        _layerListCountBitwidth: number
    ): void {
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_LENGTH, this.length.x - 1);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_LENGTH, this.length.y - 1);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_LENGTH, this.length.z - 1);

        for (let x = 0; x < this.length.x; x++) {
            for (let y = 0; y < this.length.y; y++) {
                for (let z = 0; z < this.length.z; z++) {
                    buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_FIELD_FLAG, this.set.has(x, y, z) ? 1 : 0);
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
    public readonly fourbit: boolean;
    public readonly direction: number; // 0: 3d, 1: yz, 2: xz, 3: xy
    public readonly voxels: Point2[] | Point3[];

    constructor(origin: Point3, direction: number, voxels: Point2[] | Point3[]) {
        super(origin);
        this.fourbit = voxels.some((voxel) => voxel.x > 7 || voxel.y > 7 || (voxel instanceof Point3 && voxel.z > 7));
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

    public static formatSpecificFromBuffer(
        buffer: ReadingBitBuffer,
        origin: Point3,
        layerListCountBitwidth: number
    ): CompressedLayerDataList {
        const coordinateBitSize = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_LIST_FOURBIT) > 0 ? 4 : 3;
        const direction = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_LIST_DIRECTION);
        const length = buffer.readUIntBitsBE(layerListCountBitwidth) + 1;
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

    protected coordinateBitSize(this: CompressedLayerDataList): number {
        return this.fourbit ? 4 : 3;
    }

    protected formatSpecificCompressedSizeInBits(
        this: CompressedLayerDataList,
        layerListCountBitwidth: number
    ): number {
        let size = 0;
        size += BIT_LENGTH.LAYER_VOXEL_LIST_FOURBIT;
        size += BIT_LENGTH.LAYER_VOXEL_LIST_DIRECTION;
        size += layerListCountBitwidth;
        size += this.voxels.length * this.coordinateBitSize() * (this.direction === 0 ? 3 : 2);
        return size;
    }

    protected formatSpecificToBuffer(buffer: WritingBitBuffer, layerListCountBitwidth: number): void {
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_LIST_FOURBIT, this.fourbit ? 1 : 0);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_LIST_DIRECTION, this.direction);
        if (this.voxels.length < 1) {
            throw new Error('LayerDataList must have at least one voxel');
        }
        buffer.writeUIntBitsBE(layerListCountBitwidth, this.voxels.length - 1);

        const coordinateBitSize = this.coordinateBitSize();
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

    public serializedListCount(this: CompressedLayerDataList): number {
        return this.voxels.length - 1;
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

class LayerCompressionChoice {
    public readonly layer: OnlyBotLayer;
    public readonly field: CompressedLayerDataField;
    public readonly list: CompressedLayerDataList;

    private choice: 'FIELD' | 'LIST' | null = null;

    constructor(layer: OnlyBotLayer, field: CompressedLayerDataField, list: CompressedLayerDataList) {
        this.layer = layer;
        this.field = field;
        this.list = list;
    }

    static init(layer: OnlyBotLayer): LayerCompressionChoice {
        if (layer.voxels.length < 1) {
            throw new Error('Layer has no voxels!');
        }

        // clone the points because we're about to pack them
        const voxels = layer.voxels.map((voxel) => voxel.clone());
        const origin = calculateVoxelBounds(voxels).min;

        const max = packVoxelSpace(voxels);
        const length = max.toLength();

        return new LayerCompressionChoice(
            layer,
            CompressedLayerDataField.compress(origin, length, voxels),
            CompressedLayerDataList.compress(origin, length, voxels)
        );
    }

    public getChoice(this: LayerCompressionChoice): 'FIELD' | 'LIST' | null {
        return this.choice;
    }

    public choose(this: LayerCompressionChoice, choice: 'FIELD' | 'LIST'): void {
        this.choice = choice;
    }

    public getListLength(this: LayerCompressionChoice): number {
        if (this.choice === 'FIELD') {
            return 0;
        }

        return this.list.serializedListCount();
    }

    public getFieldCompressedSize(this: LayerCompressionChoice): number {
        return this.field.compressedSizeInBits(0);
    }

    public getListCompressedSize(this: LayerCompressionChoice, layerListCountBitwidth: number): number {
        return this.list.compressedSizeInBits(layerListCountBitwidth);
    }

    public toCompressedLayer(this: LayerCompressionChoice): CompressedLayer {
        if (this.choice === null) {
            throw new Error('Must choose compression type before compressing');
        }

        return CompressedLayer.compress(this.layer, this.choice === 'FIELD' ? this.field : this.list);
    }
}

export class CompressedBot {
    public readonly name: string;
    public readonly anchor: [number, number, number];
    public readonly materials: CompressedMaterial[];
    public readonly layers: CompressedLayer[];

    public readonly layerListCountBitwidth: number;

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

        const sizes = layers.map((layer) =>
            layer.data instanceof CompressedLayerDataList ? layer.data.serializedListCount() : 0
        );
        const maxCount = Math.max(0, ...sizes);
        this.layerListCountBitwidth = minBitsRequired(maxCount);
    }

    public static compress(
        bot: OnlyBot,
        compressMaterial: (material: OnlyBotMaterial) => CompressedMaterial
    ): CompressedBot {
        const materials = bot.materials.map(compressMaterial);
        const choices = bot.layers.map((layer) => LayerCompressionChoice.init(layer));

        // First, eliminate all of the layers that would be fields regardless of list length bitwidth
        const bestCaseBitwidth = 1;
        choices.forEach((choice) => {
            if (choice.getFieldCompressedSize() <= choice.getListCompressedSize(bestCaseBitwidth)) {
                choice.choose('FIELD');
            }
        });

        let updated: boolean;
        let remainingWorstCaseBitwidth: number;

        // Second, loop through the remaining layers and find the worst remaining bitwidth
        // Use that to determine if any lists are better than fields
        // Repeat until there are no more layers that are better as lists than fields
        do {
            updated = false;
            remainingWorstCaseBitwidth = minBitsRequired(
                Math.max(
                    0,
                    ...choices
                        .filter((choice) => choice.getChoice() !== 'FIELD')
                        .map((choice) => choice.getListLength())
                )
            );

            choices
                .filter((choice) => choice.getChoice() === null)
                .forEach((choice) => {
                    // If this list at its worst case bitwidth is smaller than the field, choose list
                    // Otherwise, if this is the worst case bitwidth, choose field -
                    //   since this is the worst case, the list size will never decrease below the field size if it hasn't already
                    if (choice.getListCompressedSize(remainingWorstCaseBitwidth) < choice.getFieldCompressedSize()) {
                        choice.choose('LIST');
                        updated = true;
                    } else if (choice.getListLength() === remainingWorstCaseBitwidth) {
                        choice.choose('FIELD');
                        updated = true;
                    }
                });
        } while (updated);

        // Last, set any remaining layers
        choices
            .filter((choice) => choice.getChoice() === null)
            .forEach((choice) => {
                if (choice.getFieldCompressedSize() <= choice.getListCompressedSize(remainingWorstCaseBitwidth)) {
                    choice.choose('FIELD');
                } else {
                    choice.choose('LIST');
                }
            });

        const layers = choices.map((choice) => choice.toCompressedLayer());
        return new CompressedBot(bot.name, [bot.anchor.x, bot.anchor.y, bot.anchor.z], materials, layers);
    }

    public static fromBuffer(buffer: ReadingBitBuffer, colorCountBitwidth: number): CompressedBot {
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
            const color = buffer.readUIntBitsBE(colorCountBitwidth);
            const shader = buffer.readUIntBitsBE(BIT_LENGTH.MATERIAL_SHADER);
            materials.push({ color, shader });
        }
        const layerListCountBitwidth = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_LIST_COUNT_BITWIDTH);
        const layerCount = buffer.readUIntBitsBE(BIT_LENGTH.LAYER_COUNT) + 1;
        const layers: CompressedLayer[] = [];
        for (let i = 0; i < layerCount; i++) {
            layers.push(CompressedLayer.fromBuffer(buffer, layerListCountBitwidth));
        }
        return new CompressedBot(name, anchor, materials, layers);
    }

    public compressedSizeInBits(this: CompressedBot, colorCountBitwidth: number): number {
        let size = 0;
        size += BIT_LENGTH.NAME_COUNT;
        size += this.name.length * BIT_LENGTH.NAME_CHAR;
        size += BIT_LENGTH.ANCHOR_XZ_SIGN;
        size += BIT_LENGTH.ANCHOR_X;
        size += BIT_LENGTH.ANCHOR_Y;
        size += BIT_LENGTH.ANCHOR_XZ_SIGN;
        size += BIT_LENGTH.ANCHOR_Z;
        size += BIT_LENGTH.MATERIAL_COUNT;
        size += this.materials.length * (colorCountBitwidth + BIT_LENGTH.MATERIAL_SHADER);
        size += BIT_LENGTH.LAYER_VOXEL_LIST_COUNT_BITWIDTH;
        size += BIT_LENGTH.LAYER_COUNT;
        size += this.layers.reduce((sum, layer) => sum + layer.compressedSizeInBits(this.layerListCountBitwidth), 0);
        return size;
    }

    public toBuffer(this: CompressedBot, buffer: WritingBitBuffer, colorCountBitwidth: number): void {
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
            buffer.writeUIntBitsBE(colorCountBitwidth, material.color);
            buffer.writeUIntBitsBE(BIT_LENGTH.MATERIAL_SHADER, material.shader);
        });
        if (this.layers.length < 1) {
            throw new Error('Must have at least one layer');
        }
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_VOXEL_LIST_COUNT_BITWIDTH, this.layerListCountBitwidth);
        buffer.writeUIntBitsBE(BIT_LENGTH.LAYER_COUNT, this.layers.length - 1);
        this.layers.forEach((layer) => {
            layer.toBuffer(buffer, this.layerListCountBitwidth);
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

    public readonly colorCountBitwidth: number;

    constructor(colors: CompressedColor[], bots: CompressedBot[]) {
        this.colors = colors;
        this.bots = bots;

        this.colorCountBitwidth = minBitsRequired(colors.length - 1);
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
        const colorCountBitwidth = buffer.readUIntBitsBE(BIT_LENGTH.COLOR_COUNT_BITWIDTH);
        const colorCount = buffer.readUIntBitsBE(colorCountBitwidth) + 1;
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

            bots.push(CompressedBot.fromBuffer(buffer, colorCountBitwidth));
        }

        return new CompressedBots(colors, bots);
    }

    public compressedSizeInBits(this: CompressedBots): number {
        let size = 0;
        size += BIT_LENGTH.COLOR_COUNT_BITWIDTH;
        size += this.colorCountBitwidth;
        size += this.colors.length * (BIT_LENGTH.COLOR_RGB * 3);

        size += this.bots.length * BIT_LENGTH.BOT_LENGTH;
        size += this.bots.reduce((sum, bot) => sum + bot.compressedSizeInBits(this.colorCountBitwidth), 0);
        return size;
    }

    public toBuffer(this: CompressedBots): Buffer {
        const buffer = new WritingBitBuffer(this.compressedSizeInBits());
        if (this.colors.length < 1) {
            throw new Error('No colors');
        }
        buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_COUNT_BITWIDTH, this.colorCountBitwidth);
        buffer.writeUIntBitsBE(this.colorCountBitwidth, this.colors.length - 1);
        this.colors.forEach(({ r, g, b }) => {
            buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_RGB, r);
            buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_RGB, g);
            buffer.writeUIntBitsBE(BIT_LENGTH.COLOR_RGB, b);
        });
        this.bots.forEach((bot) => {
            buffer.writeUIntBitsBE(BIT_LENGTH.BOT_LENGTH, bot.compressedSizeInBits(this.colorCountBitwidth));
            bot.toBuffer(buffer, this.colorCountBitwidth);
        });

        return buffer.end();
    }

    public expand(this: CompressedBots): OnlyBot[] {
        return this.bots.map((bot) => bot.expand(this.colors));
    }
}
