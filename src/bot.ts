import * as t from 'runtypes';
import { Point3 } from '@/point';
import { packVoxelSpace } from '@/utils';

export const OnlyBotLayerType = ['body', 'eye', 'arm', 'leg', 'top', 'tail'] as const;
export type OnlyBotLayerType = typeof OnlyBotLayerType[number];

export const OnlyBotLayerId: Record<OnlyBotLayerType, number> = {
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
    shader: number;
};

export type OnlyBotLayer = {
    type: number;
    material: number;
    voxels: Point3[];
};

export const OnlyBotJson = t.Record({
    name: t.String,
    anchor: t.Record({
        x: t.Number,
        y: t.Number,
        z: t.Number,
    }),
    materials: t.Array(
        t.Record({
            color: t.Tuple(t.Number, t.Number, t.Number),
            shader: t.Number,
        })
    ),
    layers: t.Array(
        t.Record({
            type: t.Number,
            material: t.Number,
            voxels: t.Array(t.Tuple(t.Number, t.Number, t.Number)),
        })
    ),
});
export type OnlyBotJson = t.Static<typeof OnlyBotJson>;

export type OpenseaAttribute = {
    trait_type?: string;
    display_type?: 'number' | 'date' | 'boost_number' | 'boost_percentage';
    value: string | number;
};

export type OnlyBotMetadata = {
    name: string;
    image: string;
    attributes: OpenseaAttribute[];
    bot: OnlyBotJson;
};

export class OnlyBot {
    public readonly name: string;
    public readonly anchor: OnlyBotAnchor;
    public readonly materials: OnlyBotMaterial[];
    public readonly layers: OnlyBotLayer[];
    public readonly max: Point3;
    public readonly length: Point3;

    constructor(name: string, anchor: OnlyBotAnchor, materials: OnlyBotMaterial[], layers: OnlyBotLayer[]) {
        this.name = name;
        this.anchor = anchor;
        this.materials = materials;
        this.layers = layers;
        this.max = packVoxelSpace(layers.flatMap((layer) => layer.voxels));
        this.length = this.max.toLength();

        // Sort layer voxels for comparing serialized forms
        this.layers.forEach((layer) => layer.voxels.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z));

        // TODO: assertions
    }

    static fromJSON(json: unknown): OnlyBot {
        const checked = OnlyBotJson.check(json);

        return new OnlyBot(
            checked.name,
            checked.anchor,
            checked.materials,
            checked.layers.map((layer) => ({
                ...layer,
                voxels: layer.voxels.map(([x, y, z]: [number, number, number]) => new Point3(x, y, z)),
            }))
        );
    }

    public voxels(this: OnlyBot): Point3[] {
        return this.layers.flatMap((layer: OnlyBotLayer) => layer.voxels);
    }

    public pack(this: OnlyBot): void {
        packVoxelSpace(this.voxels()).copyTo(this.max);
        this.max.toLength().copyTo(this.length);
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
                .map(({ color, shader }) => {
                    return this.indent(
                        indent,
                        2,
                        `{${s}"color":${s}[${color[0].toString(10)},${s}${color[1].toString(
                            10
                        )},${s}${color[2].toString(10)}],${s}"shader":${s}${shader.toString(10)}${s}}`
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
