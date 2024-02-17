import Ajv from 'ajv';
import { Point3 } from '@/point.js';
import { packVoxelSpace } from '@/utils.js';

// https://arethetypeswrong.github.io/?p=ajv%408.12.0
const ajv = new (Ajv as unknown as typeof Ajv.default)();

export const OnlyBotLayerType = ['body', 'eye', 'arm', 'leg', 'top', 'tail'] as const;
export type OnlyBotLayerType = typeof OnlyBotLayerType[number];

export const OnlyBotLayerTypeId: Record<OnlyBotLayerType, number> = {
    body: OnlyBotLayerType.indexOf('body'),
    eye: OnlyBotLayerType.indexOf('eye'),
    arm: OnlyBotLayerType.indexOf('arm'),
    leg: OnlyBotLayerType.indexOf('leg'),
    top: OnlyBotLayerType.indexOf('top'),
    tail: OnlyBotLayerType.indexOf('tail'),
};

export type OnlyBotAnchor = {
    x: number;
    y: number;
    z: number;
};

export type OnlyBotMaterial = {
    color: [number, number, number];
    preset: number;
};

export type OnlyBotLayer = {
    type: number;
    material: number;
    voxels: Point3[];
};

export type OnlyBotJson = {
    name: string;
    anchor: {
        x: number;
        y: number;
        z: number;
    };
    materials: Array<{
        color: [number, number, number];
        preset: number;
    }>;
    layers: Array<{
        type: number;
        material: number;
        voxels: Array<[number, number, number]>;
    }>;
};

// prettier-ignore
const OnlyBotJsonSchema = {"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"name":{"type":"string"},"anchor":{"type":"object","properties":{"x":{"type":"number"},"y":{"type":"number"},"z":{"type":"number"}},"required":["x","y","z"]},"materials":{"type":"array","items":{"type":"object","properties":{"color":{"type":"array","items":{"type":"number"},"minItems":3,"maxItems":3},"preset":{"type":"number"}},"required":["color","preset"]}},"layers":{"type":"array","items":{"type":"object","properties":{"type":{"type":"number"},"material":{"type":"number"},"voxels":{"type":"array","items":{"type":"array","items":{"type":"number"},"minItems":3,"maxItems":3}}},"required":["type","material","voxels"]}}},"required":["name","anchor","materials","layers"]};
const OnlyBotJsonValidator = ajv.compile<OnlyBotJson>(OnlyBotJsonSchema);

type MetadataAttribute = {
    trait_type?: string;
    display_type?: 'number' | 'date' | 'boost_number' | 'boost_percentage';
    value: string | number;
};

type MetadataAsset = {
    name: string;
    type: string;
    uri: string;
};

type TokenMetadata<E> = {
    name: string;
    description: string;
    external_url: string;
    image: string;
    animation_url?: string;
    attributes: MetadataAttribute[];
    assets: MetadataAsset[];
    ext: E;
};

export type OnlyBotMetadata = TokenMetadata<{ source: OnlyBotJson }>;

export class OnlyBot {
    public readonly name: string;
    public readonly anchor: OnlyBotAnchor;
    public readonly materials: OnlyBotMaterial[];
    public readonly layers: OnlyBotLayer[];

    constructor(name: string, anchor: OnlyBotAnchor, materials: OnlyBotMaterial[], layers: OnlyBotLayer[]) {
        this.name = name;
        this.anchor = anchor;
        this.materials = materials;
        this.layers = layers;
        packVoxelSpace(layers.flatMap((layer) => layer.voxels));

        // Sort layer voxels for comparing serialized forms
        this.layers.forEach((layer) => layer.voxels.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z));

        // TODO: assertions
    }

    static fromJSON(json: unknown): OnlyBot {
        if (!OnlyBotJsonValidator(json)) {
            throw new Error('Invalid OnlyBot JSON');
        }
        return new OnlyBot(
            json.name,
            json.anchor,
            json.materials,
            json.layers.map((layer) => ({
                ...layer,
                voxels: layer.voxels.map(([x, y, z]: [number, number, number]) => new Point3(x, y, z)),
            }))
        );
    }

    public voxels(this: OnlyBot): Point3[] {
        return this.layers.flatMap((layer: OnlyBotLayer) => layer.voxels);
    }

    private indent(indent: string | undefined, level: number, line: string): string {
        return indent === undefined ? line : indent.repeat(level) + line;
    }

    public toJSON(this: OnlyBot, indent?: string): string {
        const s = indent === undefined ? '' : ' ';
        const n = indent === undefined ? '' : '\n';

        let json = '';
        json += `{${n}`;
        json += this.indent(indent, 1, `"name":${s}${JSON.stringify(this.name)},${n}`);
        json += this.indent(
            indent,
            1,
            `"anchor":${s}{${s}"x":${s}${this.anchor.x.toString(10)},${s}"y":${s}${this.anchor.y.toString(
                10
            )},${s}"z":${s}${this.anchor.z.toString(10)}${s}},${n}`
        );
        json += this.indent(indent, 1, `"materials":${s}[${n}`);
        json +=
            this.materials
                .map(({ color, preset }) => {
                    return this.indent(
                        indent,
                        2,
                        `{${s}"color":${s}[${color[0].toString(10)},${s}${color[1].toString(
                            10
                        )},${s}${color[2].toString(10)}],${s}"preset":${s}${preset.toString(10)}${s}}`
                    );
                })
                .join(`,${n}`) + n;
        json += this.indent(indent, 1, `],${n}`);
        json += this.indent(indent, 1, `"layers":${s}[${n}`);
        json +=
            this.layers
                .map(({ type, material, voxels }) => {
                    let layer = '';
                    layer += this.indent(
                        indent,
                        2,
                        `{${s}"type":${s}${type.toString(10)},${s}"material":${s}${material.toString(
                            10
                        )},${s}"voxels":${s}[${n}`
                    );
                    layer +=
                        voxels
                            .map((voxel) =>
                                this.indent(
                                    indent,
                                    3,
                                    `[${voxel.x.toString(10)},${s}${voxel.y.toString(10)},${s}${voxel.z.toString(10)}]`
                                )
                            )
                            .join(`,${n}`) + n;
                    layer += this.indent(indent, 2, `]}`);
                    return layer;
                })
                .join(`,${n}`) + n;
        json += this.indent(indent, 1, `]${n}`);
        json += '}';
        return json;
    }
}
