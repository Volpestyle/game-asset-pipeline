## Basic model info

Model name: retro-diffusion/rd-plus
Model description: High quality and authentic pixel art image generation


## Model inputs

- prompt (required): Text prompt for generation (string)
- style (optional): Style to apply to the generated image

default: Clean pixel art style with bold colors and outlines
retro: Classic pixel art style inspired by PC98 games
watercolor: Pixel art mixed with a watercolor painting aesthetic
textured: Semi-realistic pixel art style with lots of shading and texture
cartoon: Simple shapes and shading, with bold outlines
ui_element: User interface boxes and buttons
item_sheet: Sheets of objects placed on a simple background
character_turnaround: Character sprites viewed from different angles
environment: One-point perspective scenes with outlines and strong shapes
isometric: 45 degree isometric perspective, with consistent outlines
isometric_asset: 45 degree isometric objects or assets, on a neutral background
topdown_map: Video game map style pixel art with a 3/4 top down perspective
topdown_asset: 3/4 top down perspective game assets on a simple background
classic: Strongly outlined medium-resolution pixel art with a focus on simple shading and clear design
topdown_item: Small 3/4 top down perspective assets with no background
low_res: High quality, low resolution pixel art assets and backgrounds
mc_item: High quality Minecraft-styled items and game assets
mc_texture: Detailed Minecraft-style flat block textures, with enhanced prompt following
skill_icon: Video game style skill icons for representing abilities (string)
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

### Example (https://replicate.com/p/1mx7bbk2gdrm80ctap1rhe1r50)

#### Input

```json
{
  "style": "default",
  "width": 128,
  "height": 128,
  "prompt": "knight on horse emerging from flames creating shockwave slash effect",
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
  "https://replicate.delivery/xezq/Xiecrt8v6zxTECYtaHnIWz7lr4BjeWZmsgxRX5KLbU9NjVmVA/output_0.png"
]
```


### Example (https://replicate.com/p/c1h51rfhxhrmc0ctap39skph88)

#### Input

```json
{
  "style": "classic",
  "width": 128,
  "height": 128,
  "prompt": "bipedal mech stomping through burning city firing missiles",
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
  "https://replicate.delivery/xezq/PmP37m6ZvZIkKlAecUn4eMvFvPMOh9qOSHcgP9Am9VtfNrMrA/output_0.png"
]
```


### Example (https://replicate.com/p/kg76kdw6t1rme0ctap4atw68gg)

#### Input

```json
{
  "style": "cartoon",
  "width": 256,
  "height": 256,
  "prompt": "superhero frog leaping with cape billowing collecting coins",
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
  "https://replicate.delivery/xezq/5KiQDNi8lIYTEp2CCfHaXj4EGqH2NDqaNwXp4Y4efcGCRrMrA/output_0.png"
]
```


### Example (https://replicate.com/p/76x0yq8myxrma0ctba4vxq07sg)

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
  "https://replicate.delivery/xezq/u7zefUeAd9I32J2EjPVfwDPC5aPM4pO6LTyWdCgXe6d9ehqZF/output_0.png"
]
```


### Example (https://replicate.com/p/x1kqpa07pdrmc0ctba7vy2r55g)

#### Input

```json
{
  "style": "ui_element",
  "width": 240,
  "height": 240,
  "prompt": "spaceship",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.9,
  "remove_bg": true,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/ffnxxijSEEhsnUejFc97DuKo7nDMJ8YkE4olBnfOioby4oaWB/output_0.png"
]
```


### Example (https://replicate.com/p/qpxpvetttxrm80ctba7rgwmv6r)

#### Input

```json
{
  "style": "topdown_map",
  "width": 384,
  "height": 384,
  "prompt": "office",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.9,
  "remove_bg": true,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/fskpfCZfNGeebiqufmLbRSzH9Tk2wa7Ot3Nrx8Ybr73NtjqZF/output_0.png"
]
```


### Example (https://replicate.com/p/dk999f2dc5rme0ctba8seje4q4)

#### Input

```json
{
  "style": "character_turnaround",
  "width": 240,
  "height": 240,
  "prompt": "Gorilla worrior",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.9,
  "remove_bg": true,
  "num_images": 1,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/VwXWla5fJrV2I6Q6wcCtz3sjCsMTAO9yeaI7CYTxXgmSQqmVA/output_0.png"
]
```


### Example (https://replicate.com/p/39ckat82b5rm80ctbtgsk0myyg)

#### Input

```json
{
  "style": "classic",
  "width": 192,
  "height": 144,
  "prompt": "A quaint village rests on the edge of a sparking lake, with trees and blue sky in the background",
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
  "https://replicate.delivery/xezq/u9FPkEdMc548JFtR000ITukSVzUNI54ZglCJRJVctZyPuuZF/output_0.png"
]
```


### Example (https://replicate.com/p/mjynev6ca5rm80ctbayss2hb60)

#### Input

```json
{
  "style": "default",
  "width": 192,
  "height": 192,
  "prompt": "wolf face",
  "tile_x": false,
  "tile_y": false,
  "strength": 0.8,
  "remove_bg": false,
  "num_images": 1,
  "input_image": "https://replicate.delivery/pbxt/O15K1if7wn8incV4XyqSYVOCjJgF4yW7FvUepstPV4ax8Wln/download%20%283%29.png",
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/v0YQpM5I3fS8WaIfufmkzIObkuwNeq1WxeqD9Jra8f8KcvqZF/output_0.png"
]
```


## Model readme

> ![Retro Diffusion Plus Banner](https://www.retrodiffusion.ai/rd_plus_banner.png)
> Retro Diffusion models are designed specifically for grid aligned, style consistent, limited color pixel art generation. Developed by and trained in collaboration with experienced pixel artists, this family of models delivers beautiful pixel art across a wide range of styles, resolutions, and modalities.
> 
> # RD Plus
> This model is the third generation variant of Retro Diffusion "text to image" models, trained at a native pixel resolution of 256x256 or lower across over a dozen styles ranging from full scenes, to video game maps, to UI icons.
> 
> # Settings overview
> - Text and/or image inputs with support for "strength" value representing the denoise strength of the generation.
> - Width and height parameters for precise sizes. *Some styles may only support a subset of the visible range*
> - Input palette for strict color adherence.
> - Background removal
> - Tiling options for image seam wrapping.
> 
> For faster image generation, animations, or tileset generation, see these other Retro Diffusion models:
> [RD Fast](https://replicate.com/retro-diffusion/rd-fast)
> [RD Tile](https://replicate.com/retro-diffusion/rd-tile)
