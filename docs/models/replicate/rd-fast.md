## Basic model info

Model name: retro-diffusion/rd-fast
Model description: Fast pixel art image generation


## Model inputs

- prompt (required): Text prompt for generation (string)
- style (optional): Style to apply to the generated image

default: Simple clean pixel art, with Anime illustration influences
simple: Simple shading with minimalist shapes and designs
detailed: Pixel art with lots of shading and details
retro: A classic arcade game aesthetic inspired by early PC games
game_asset: Distinct assets set on a simple background
portrait: Character portrait focused images with high detail
texture: Flat game textures like stones, bricks, or wood
ui: User interface boxes and buttons
item_sheet: Sheets of objects placed on a simple background
character_turnaround: Character sprites viewed from different angles
1_bit: Two color black and white only images
low_res: General low resolution pixel art images
mc_item: Minecraft-styled items with automatic transparency
mc_texture: Minecraft-styled flat textures, like grass, stones, or wood
no_style: Pixel art with no style influence applied (string)
- width (optional): Image width (integer)
- height (optional): Image height (integer)
- num_images (optional): Number of images to generate (integer)
- input_image (optional): Input image for image-to-image generation or reference. Will be converted to RGB without transparency. (string)
- strength (optional): Prompt strength in image-to-image generation. Higher values give closer adherence to the prompt, and lower values use more information from the input image. Only used when input_image is provided. (number)
- input_palette (optional): Reference palette image to guide color choices (string)
- remove_bg (optional): Remove background to create transparent images (boolean)
- tile_x (optional): Enable seamless tiling on X axis (boolean)
- tile_y (optional): Enable seamless tiling on Y axis (boolean)
- bypass_prompt_expansion (optional): Disable automatic prompt expansion (boolean)
- seed (optional): Random seed. Set for reproducible generation (integer)


## Model output schema

{
  "type": "array",
  "items": {
    "type": "string",
    "format": "uri"
  },
  "title": "Output"
}

If the input or output schema includes a format of URI, it is referring to a file.


## Example inputs and outputs

Use these example outputs to better understand the types of inputs the model accepts, and the types of outputs the model returns:

### Example (https://replicate.com/p/srb9e2tkqxrm80ctbspsw06wrw)

#### Input

```json
{
  "style": "1_bit",
  "width": 240,
  "height": 240,
  "prompt": "Two astronauts on the moon with stars",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.9,
  "remove_bg": false,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/8t8AHIvB897iL1OIfPoKL68TfnfsiQL062FGAHbiTkY2H0NrA/output_0.png"
]
```


### Example (https://replicate.com/p/rrzd4hk6xxrmc0ctbt1tb12d5r)

#### Input

```json
{
  "style": "default",
  "width": 240,
  "height": 240,
  "prompt": "A Transylvanian castle on a hill top at night",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.9,
  "remove_bg": false,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/nvBcKsG30t61AB4zv2gU2v9eX59f2VwBkfu5rvQKXlgR10NrA/output_0.png"
]
```


### Example (https://replicate.com/p/5sj8d4qm3hrma0ctaqjr6f9c70)

#### Input

```json
{
  "style": "default",
  "width": 256,
  "height": 256,
  "prompt": "robot spider",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.8,
  "remove_bg": false,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/M6ur5vfOsc2cBS20fnvT9bysWIecHsV2RuqzP7NasP2UQuMrA/output_0.png"
]
```


### Example (https://replicate.com/p/jx5c4xez3nrma0ctba4tsfcph4)

#### Input

```json
{
  "style": "retro",
  "width": 240,
  "height": 240,
  "prompt": "ancient hero in the forest",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.9,
  "remove_bg": false,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/t2dh8BKOyXIVCZMziEPQM3wNRfIv7FdKKoEcGfaKVATvIqmVA/output_0.png"
]
```


### Example (https://replicate.com/p/9kh50k2gc9rm80ctba6rv1g89c)

#### Input

```json
{
  "style": "simple",
  "width": 240,
  "height": 240,
  "prompt": "spaceship",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.9,
  "remove_bg": false,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/xUcGuJEPRVaoIxXOS9duT8eAMaYUM08u914zPeCuNKePYUNrA/output_0.png"
]
```


## Model readme

> ![Retro Diffusion Fast Banner](https://www.retrodiffusion.ai/l5.png)
> Retro Diffusion models are designed specifically for grid aligned, style consistent, limited color pixel art generation. Developed by and trained in collaboration with experienced pixel artists, this family of models delivers beautiful pixel art across a wide range of styles, resolutions, and modalities.
> 
> # RD Fast
> This model is the second generation variant of Retro Diffusion "text to image" models, designed for speed using a low-step prediction, this model generates pixel art quickly over a set of 15 styles and a wide range of sizes.
> 
> # Settings overview
> - Text and/or image inputs with support for "strength" value representing the denoise strength of the generation.
> - Width and height parameters for precise sizes. *Some styles may only support a subset of the visible range*
> - Input palette for strict color adherence.
> - Background removal
> - Tiling options for image seam wrapping.
> 
> For higher quality image generation, animations, or tileset generation, see these other Retro Diffusion models:
> [RD Plus](https://replicate.com/retro-diffusion/rd-plus)
> [RD Animation](https://replicate.com/retro-diffusion/rd-animation)
> [RD Tile](https://replicate.com/retro-diffusion/rd-tile)
