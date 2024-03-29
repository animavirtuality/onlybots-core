# Onlybots Core

This module contains functions and classes that assist in handling the JSON and binary format of OnlyBots, as well as converting between the two.

## Table of Contents

<!-- toc -->

- [JSON Format](#json-format)
  * [JSON Example](#json-example)
  * [Coordinate System](#coordinate-system)
  * [Fields](#fields)
- [Binary Format](#binary-format)
  * [Binary Example](#binary-example)
  * [Structure](#structure)
- [Usage](#usage)
- [Reference](#reference)
  * [`OnlyBot`](#onlybot)
  * [`CompressedBots`](#compressedbots)

<!-- tocstop -->

## JSON Format

### JSON Example

```json
{
  "name": "botty mcbotface",
  "anchor": { "x": 0, "y": 0, "z": 1 },
  "materials": [
    { "color": [255, 0, 0], "preset": 0 },
    { "color": [0, 255, 0], "preset": 1 },
    { "color": [0, 0, 255], "preset": 2 },
    { "color": [255, 255, 255], "preset": 2 }
  ],
  "layers": [
    { "type": 0, "material": 0, "voxels": [
      [1, 2, 1],
      [1, 2, 2],
      [1, 2, 3],
      [1, 2, 4],
      [1, 2, 5],
      [1, 3, 1],
      [1, 3, 2],
      [1, 3, 3],
      [1, 3, 4],
      [1, 3, 5],
      [1, 4, 1],
      [1, 4, 2],
      [1, 4, 3],
      [1, 4, 4],
      [1, 4, 5],
      [1, 5, 1],
      [1, 5, 2],
      [1, 5, 3],
      [1, 5, 4],
      [1, 5, 5],
      [2, 2, 1],
      [2, 2, 2],
      [2, 2, 3],
      [2, 2, 4],
      [2, 2, 5],
      [2, 3, 1],
      [2, 3, 5],
      [2, 4, 1],
      [2, 4, 5],
      [2, 5, 1],
      [2, 5, 2],
      [2, 5, 3],
      [2, 5, 4],
      [2, 5, 5],
      [3, 2, 1],
      [3, 2, 2],
      [3, 2, 3],
      [3, 2, 4],
      [3, 2, 5],
      [3, 3, 1],
      [3, 3, 5],
      [3, 4, 1],
      [3, 4, 5],
      [3, 5, 1],
      [3, 5, 2],
      [3, 5, 3],
      [3, 5, 4],
      [3, 5, 5],
      [4, 2, 1],
      [4, 2, 2],
      [4, 2, 3],
      [4, 2, 4],
      [4, 2, 5],
      [4, 3, 1],
      [4, 3, 5],
      [4, 4, 1],
      [4, 4, 5],
      [4, 5, 1],
      [4, 5, 2],
      [4, 5, 3],
      [4, 5, 4],
      [4, 5, 5],
      [5, 2, 1],
      [5, 2, 2],
      [5, 2, 3],
      [5, 2, 4],
      [5, 2, 5],
      [5, 3, 1],
      [5, 3, 2],
      [5, 3, 3],
      [5, 3, 4],
      [5, 3, 5],
      [5, 4, 1],
      [5, 4, 2],
      [5, 4, 3],
      [5, 4, 4],
      [5, 4, 5],
      [5, 5, 1],
      [5, 5, 2],
      [5, 5, 3],
      [5, 5, 4],
      [5, 5, 5]
    ]},
    { "type": 1, "material": 1, "voxels": [
      [1, 5, 0]
    ]},
    { "type": 1, "material": 1, "voxels": [
      [5, 5, 0]
    ]},
    { "type": 2, "material": 2, "voxels": [
      [0, 4, 2]
    ]},
    { "type": 2, "material": 2, "voxels": [
      [6, 4, 2]
    ]},
    { "type": 3, "material": 2, "voxels": [
      [1, 0, 3],
      [1, 1, 3]
    ]},
    { "type": 3, "material": 2, "voxels": [
      [5, 0, 3],
      [5, 1, 3]
    ]},
    { "type": 4, "material": 3, "voxels": [
      [1, 6, 1],
      [1, 7, 2]
    ]},
    { "type": 4, "material": 3, "voxels": [
      [5, 6, 1],
      [5, 7, 2]
    ]},
    { "type": 5, "material": 3, "voxels": [
      [3, 3, 6],
      [3, 3, 7]
    ]}
  ]
}
```

### Coordinate System

All bots are defined as cubic voxels in a 3D coordinate system.
The origin (0, 0, 0) of the coordinate system is at the front, bottom, left corner of the space _from the perspective of the viewer_.
The minimum value for each coordinate is `0`, and the maximum value is `15`.

Note that the `z` value increases as you move away from the camera, which is the opposite of some other coordinate systems (e.g. THREE.js).
Coordinates can be coverted between the two by multiplying the `z` value of each voxel by `-1`.

### Fields

#### name

The name of the bot.
Allows 1-32 lowercase alphanumeric characters, spaces, and underscores (`^[a-z0-9- ]{1,32}$`).

#### anchor

An `x`, `y`, and `z` value that can offset the bot's position when rendering.

By default (anchor value of `0, 0, 0`), the bot's starting anchor point will be placed at the bottom (`y`) center (`x,z`) of the its bounding box.
In the x and z directions, this means the maximum and minimum value of any voxel in each direction (x and z) is averaged to find the starting anchor point's x and z coordinate.
The minimum value of any voxel's y coordinate is used as the starting anchor point's y coordinate.

The anchor defined in the JSON is then used to offset the starting anchor to achieve floating bots (generally without legs) or to center bots aesthetically.
The x and z values of the JSON anchor can be between `-15` and `15` (inclusive), and move the starting anchor _half a voxel_ in their respective directions.
For example, a JSON anchor value of `x: 5` and `z: -1` would move the starting anchor point by `+2.5` voxels along the x-axis (right) and `-0.5` voxels along the z-axis (towards the camera).
The y value of the JSON anchor can be between `0` and `7` (inclusive), and moves the starting anchor _one voxel_ in the positive y direction (up).

#### materials

A list of 1 to 4 materials used by the bot.
Each material consists of an RGB color and a preset index.
The preset index is used to determine how the material is rendered, indexing into a pre-defined list.

Since material rendering is highly platform dependent, the actual implementation for material preset and values may vary but the desired outcome is well-defined for each preset.
The material preset list is TBD, but will be linked here when it is populated.

#### layers

Each bot consists of at least one and up to 32 individual layers.
Each layer consists of the following:
* `type`: Which part of the bot this layer is for.
* `material`: The index of the material to use for this layer.  See `materials` above.
* `voxels`: A list of `x`, `y`, and `z` values that define the voxels that make up this layer.

The layer type is a value between `0` and `5` (inclusive):

| index | name |
|-------|------|
| 0     | body |
| 1     | eye  |
| 2     | arm  |
| 3     | leg  |
| 4     | top  |
| 5     | tail |

The layer type can be used to render or animate layers differently, or can be ignored entirely.

## Binary Format

The binary format is a direct representation of the JSON format, for deploying bots to the blockchain with as little gas as possible.
All the requirements for values in the JSON format are directly derived from assumptions made in the binary format that allow for the smallest possible encoding.

Documentation for the binary format is included here for completeness and for advanced users of this module, but it is not recommended to use the binary format directly.
Instead, use the provided `CompressedBots.compress()`, `CompressedBots.expand()`, `CompressedBots.toBuffer()` and `CompressedBots.fromBuffer()` methods to convert between the binary and JSON formats if necessary.

### Binary Example

```
0x2ffc000003fc000003fffffffc0899c174e78d304174ca011202380080c05810a40242434ffffffc63ffc63ffc63ffffff28a84802aa848050214805321480708180437281804398b0804666ac20119b99b00070
```

### Structure

The binary format is a sequence of values, where each value is a specific width _in bits_ and order is deterministic.
The width of each static value can be found in the [BIT_LENGTH](./src/compressed.ts#L6-L28) record.
Note that some languages (such as JavaScript) don't have native support for reading and writing values of arbitrary bit widths, or at arbitrary bit offsets.

When compressing multiple bots, the colors from each material in the bot are concatenated together into a single list of colors and deduplicated.
In the binary format, each material no longer has a color, but instead has an index into the shared color list.
This remains the case even when a single bot is compressed, as the format is optimized for deploying many bots at once.

Note that magnitude for each value in the format is constrained by the width of the value, with the following clarifications:
* For one-bit flags, `0` is interpreted as `false` and `1` is interpreted as `true`
* **§**: A field annotated with this symbol is a count where the value is required to be >= 1.  In order to make better use of space, the actual value is encoded as `value - 1` and _must_ be decoded as `value + 1`
    * For example, an encoded value of `0` for `MATERIAL_COUNT` means there is one material, and an encoded value of `3` means there are four materials

Therefore, the structure of the binary format is as follows:
* `COLOR_COUNT_BITWIDTH`: the number of bits used to store color count and index in this group of bots, referenced here as `colorCountBitwidth`
* **§** `colorCountBitwidth`: the number of colors that directly follow
* a list of colors:
    * `COLOR_RGB`: the red component of the color
    * `COLOR_RGB`: the green component of the color
    * `COLOR_RGB`: the blue component of the color
* a list of bots - list end is inferred when buffer ends or bot length is `0` (buffer is padded with `0` to align to a byte boundary):
    * `BOT_LENGTH`: the length in bits of the bot: used to traverse the list when choosing a specific bot
    * **§** `NAME_COUNT`: the number of characters in the bot's name
    * a list of characters:
        * `NAME_CHAR`: a character, encoded with `mapAsciiToBits` and decoded with `mapBitsToAscii`
    * `ANCHOR_XZ_SIGN`: the sign (+ or -) of the x value of the anchor
    * `ANCHOR_X`: the absolute value of the x value of the anchor
    * `ANCHOR_Y`: the y value of the anchor
    * `ANCHOR_XZ_SIGN`: the sign (+ or -) of the z value of the anchor
    * `ANCHOR_Z`: the absolute value of the z value of the anchor
    * **§** `MATERIAL_COUNT`: the number of materials that directly follow
    * a list of materials:
        * `colorCountBitwidth`: the index of the material's color in the color list
        * `MATERIAL_PRESET`: the index of the material's preset
    * `LAYER_VOXEL_LIST_COUNT_BITWIDTH`: the number of bits used for the count of voxels in any layer data formatted as a list for this bot, referenced here as `layerListCountBitwidth`
    * **§** `LAYER_COUNT`: the number of layers that directly follow
    * a list of layers:
        * `LAYER_TYPE`: the type of the layer
        * `LAYER_MATERIAL`: the index of the layer's material in the material list
        * `LAYER_VOXEL_ORIGIN`: the x value of the origin that the layer voxels are relative to
        * `LAYER_VOXEL_ORIGIN`: the y value of the origin that the layer voxels are relative to
        * `LAYER_VOXEL_ORIGIN`: the z value of the origin that the layer voxels are relative to
        * `LAYER_VOXEL_FORMAT`: a flag that indicates whether the layer voxels are encoded as a list or field
        * if list (`true`):
            * `LAYER_VOXEL_LIST_FOURBIT`: a flag that indicates whether voxel coordinates are `3` (`false`) or `4` (`true`) bits wide, referenced here as `coordinateBitSize`
            * `LAYER_VOXEL_LIST_DIRECTION`: whether voxels that follow are in `x,y,z`, `y,z`, `x,z`, or `x,y` form.  For 2d voxels, missing coordinate is equal to origin value for that axis.
            * **§** `layerListCountBitwidth`: the number of voxels that directly follow
            * for each voxel:
                * `coordinateBitSize`: the first coordinate
                * `coordinateBitSize`: the second coordinate
                * if direction is `x,y,z`:
                    * `coordinateBitSize`: the third coordinate
        * if field (`false`):
            * **§** `LAYER_VOXEL_FIELD_LENGTH`: the length of the field along the x-axis
            * **§** `LAYER_VOXEL_FIELD_LENGTH`: the length of the field along the y-axis
            * **§** `LAYER_VOXEL_FIELD_LENGTH`: the length of the field along the z-axis
            * a bit-field of `LAYER_VOXEL_FIELD_FLAG` with length `length.x` * `length.y` * `length.z` that indicates whether a voxel is present at that position by `field[x][y][z] === 1`.  Field is serialized and deserialized with the following order of nested loops:
              ````
              for (x) {
                for (y) {
                  for (z) {
                    // ...
                  }
                }
              }  
              ````

## Usage

```
npm i @anima-virtuality/onlybots-core
```

## Reference

_Note: the docs below are not exhaustive, but should cover the most common use cases._

________________________________________________________________________________________________________________________
### `OnlyBot`

A helper class that wraps the JSON format of a single bot.

#### Properties

- `name: string`
- `anchor: { x: number, y: number, z: number }`
- `materials: { color: [number, number, number], preset: number }[]`
- `layers: { type: number, material: number, voxels: [number, number, number][]`

#### Methods

- `static fromJSON(json: unknown): OnlyBot`
    > Uses [runtypes](https://github.com/pelotom/runtypes) to ensure that a javascript object has a valid bot structure, and then returns a new `OnlyBot` instance.
    Note that this method accepts the result of `JSON.parse()` and not the raw JSON string.
- `constructor(name: string, anchor: OnlyBotAnchor, materials: OnlyBotMaterial[], layers: OnlyBotLayer[])`
  > Creates a new `OnlyBot` instance.
- `toJSON(indent?: string): string`
    > Formats the bot as a JSON string.
- `voxels(): Point3[]`
    > Returns a flattened list of all voxels in all layers.  Keep in mind that the `Point3` class is _mutable_.

________________________________________________________________________________________________________________________
### `CompressedBots`

A helper class that can convert to and from the binary format for multiple bots.

#### Properties

- `static BIT_LENGTH: { ... }`
    > A record of the bit lengths of each value in the binary format.

#### Methods

- `static compress(bots: OnlyBot[]): CompressedBots`
    > Compresses a list of `OnlyBot` instances into a single `CompressedBots` instance.
- `static fromBuffer(rawBuffer: Buffer): CompressedBots`
    > Creates a new `CompressedBots` instance from a `Buffer` containing bots in binary format.
- `compressedSizeInBits(this: CompressedBots): number`
    > Calculates the size of the compressed bots in bits.
- `toBuffer(this: CompressedBots): Buffer`
    > Converts the compressed bots into a `Buffer` containing the binary format.
- `expand(this: CompressedBots): OnlyBot[]`
    > Converts the compressed bots into a list of `OnlyBot` instances.
