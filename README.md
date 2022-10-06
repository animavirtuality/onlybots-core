# OnlyBots Core

This module contains functions and classes that assist in handling the JSON and binary format of OnlyBots, as well as converting between the two.

## JSON Format

### Example

```json
{
  "name": "botty mcbotface",
  "anchor": { "x": 0, "y": 0, "z": 1 },
  "materials": [
    { "color": [255, 0, 0], "shader": 0 },
    { "color": [0, 255, 0], "shader": 1 },
    { "color": [0, 0, 255], "shader": 2 },
    { "color": [255, 255, 255], "shader": 2 }
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
The origin (0, 0, 0) of the coordinate system is at the front, bottom, left corner of the space.
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

An array of 1 to 4 materials used by the bot.
Each material consists of an RGB color and a shader index.
The shader index is used to determine how the material is rendered, indexing into a pre-defined list.

Since material rendering is highly platform dependent, the actual implementation for material shaders and values may vary but the desired outcome is well-defined for each shader.
The shader list is TBD, but will be linked here when it is populated.

### layers

Each bot consists of at least one and up to 32 individual layers.
Each layer consists of the following:
* `type`: Which part of the bot this layer is for.
* `material`: The index of the material to use for this layer.  See `materials` above.
* `voxels`: An array of `x`, `y`, and `z` values that define the voxels that make up this layer.

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
