## Basic model info

Model name: retro-diffusion/rd-animation
Model description: Style consistent animated pixel art sprite generation


## Model inputs

- prompt (required): Text prompt for generation (string)
- style (optional): Style to apply to the generated image

four_angle_walking: Consistent 4 direction, 4 frame long walking animations of humanoid characters
walking_and_idle: Consistent 4 direction walking and idle animations of humanoid characters
small_sprites: 4 direction 32x32 sprites with walking, arm raising/attacking, looking around, surprised, and laying down animations
vfx: Eye-catching animations for fire, explosions, lightning, or other simple effects (string)
- width (optional): Animation width. four_angle_walking and walking_and_idle only support 48. small_sprites only supports 32. vfx supports 24-96. (integer)
- height (optional): Animation height. four_angle_walking and walking_and_idle only support 48. small_sprites only supports 32. vfx supports 24-96. (integer)
- input_image (optional): Input image for image-to-image generation or reference. Will be converted to RGB without transparency. (string)
- return_spritesheet (optional): Return animation as a spritesheet PNG instead of animated GIF (boolean)
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

### Example (https://replicate.com/p/tw7wwzmsk9rme0ctbt494atgy4)

#### Input

```json
{
  "style": "four_angle_walking",
  "width": 48,
  "height": 48,
  "prompt": "Cool corgi with sunglasses",
  "return_spritesheet": false,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/STrMzg7XNwbuNt8NwNBwKBehbBi7AhnniqpGaq2Teib4f0NrA/output_0.gif"
]
```


### Example (https://replicate.com/p/vgw6spd4chrme0ctb75tba88cw)

#### Input

```json
{
  "style": "four_angle_walking",
  "width": 96,
  "height": 96,
  "prompt": "happy tomato",
  "return_spritesheet": false,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/A87SjeyvQuzvVy0wcEeU7t8YR0HaMo3zEejGsBfotiqWXcaWB/output_0.gif"
]
```


### Example (https://replicate.com/p/tfb42kf1ahrma0ctb4p8ztbny0)

#### Input

```json
{
  "style": "walking_and_idle",
  "width": 64,
  "height": 64,
  "prompt": "Cat knight",
  "input_image": "https://replicate.delivery/xezq/cLbSs9oK964iPFPeAftnxkBoCdCLB4pd3FCSL2x7LSzDeINrA/tmpi8bln6e_.jpg",
  "return_spritesheet": false,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/UW8QAPcGAIK8ElItMjawMQwSrkxfPJqe5Qx86HcL6kfcGJNrA/output_0.gif"
]
```


### Example (https://replicate.com/p/6ezftr6kkdrme0ctb5kbrdryzw)

#### Input

```json
{
  "style": "four_angle_walking",
  "width": 48,
  "height": 48,
  "prompt": "Frog with a jetpack",
  "return_spritesheet": false,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/NlBVyGP8Qs7DFZVFGwWv6W9bIXS4dKRlVNVrhJS1yG3pXpZF/output_0.gif"
]
```


### Example (https://replicate.com/p/c3vwah7g6hrmc0ctb9z8g4sw3w)

#### Input

```json
{
  "style": "four_angle_walking",
  "width": 96,
  "height": 96,
  "prompt": "Wizard in colorful robe",
  "return_spritesheet": false,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/oTI8PvOKjkZrKJOHKU6vdhbVEO8huPI4jCmlCe5hBe0c9pmVA/output_0.gif"
]
```


### Example (https://replicate.com/p/vk7vmyg8g1rmc0ctba19yqqrk4)

#### Input

```json
{
  "style": "four_angle_walking",
  "width": 96,
  "height": 96,
  "prompt": "Wizard in colorful robe",
  "return_spritesheet": true,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/KeYBtFNxerv3p0cJ2N7hSDlpGN84hHVPYD9iT2k6iekUBUNrA/output_0.png"
]
```


### Example (https://replicate.com/p/hv63zc7vysrme0ctbayaxymv3m)

#### Input

```json
{
  "style": "small_sprites",
  "width": 32,
  "height": 32,
  "prompt": "a corgi wearing cool sunglasses",
  "return_spritesheet": false,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/yz7uvrAOkRKmJRWra2KoLxtVD1LJCON8eUQZXkKgoUQe8qmVA/output_0.gif"
]
```


### Example (https://replicate.com/p/7qej7pddzxrmc0ctbayvqvk8sg)

#### Input

```json
{
  "style": "vfx",
  "width": 48,
  "height": 48,
  "prompt": "a swirling blue portal",
  "return_spritesheet": false,
  "bypass_prompt_expansion": false
}
```

#### Output

```json
[
  "https://replicate.delivery/xezq/O78XbWiteLVhMqiWrv480k3BJ7jblkuMRQJSlVBQ2fF29qmVA/output_0.gif"
]
```


## Model readme

> ![Retro Diffusion Animation Banner](https://www.retrodiffusion.ai/walk.webp)
> Retro Diffusion models are designed specifically for grid aligned, style consistent, limited color pixel art generation. Developed by and trained in collaboration with experienced pixel artists, this family of models delivers beautiful pixel art across a wide range of styles, resolutions, and modalities.
> 
> # RD Animation
> This model generates animated pixel art sprites and spritesheets, with low framerates that perfectly match established conventions, and sheets organized for easy compatibility with various game engines. Each style has a dedicated look and format, ensuring positioning and action consistency across generations.
> 
> # Settings overview
> - Text and/or image reference inputs. *Image references are not used as direct initial images for generation*
> - Input palette for strict color adherence.
> *Note: different styles only support specific sizes.*
> 
> # Spritesheet formats
> Walking and idle:
> ![Walking spritesheet legend](https://da8ztllw6by0f.cloudfront.net/09fa46ca4bca251a67849ef038e26344.png)
> 
> Small sprites:
> ![Small spritesheet legend](https://da8ztllw6by0f.cloudfront.net/e470426ab1cb361dd37519b416d48de8.png)
> 
> For image generation or tileset generation, see these other Retro Diffusion models:
> [RD Plus](https://replicate.com/retro-diffusion/rd-plus)
> [RD Fast](https://replicate.com/retro-diffusion/rd-fast)
> [RD Tile](https://replicate.com/retro-diffusion/rd-tile)
