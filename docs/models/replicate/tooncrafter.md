## Basic model info

Model name: fofr/tooncrafter
Model description: Create videos from illustrated input images


## Model inputs

- prompt (optional):  (string)
- negative_prompt (optional): Things you do not want to see in your video (string)
- max_width (optional): Maximum width of the video (integer)
- max_height (optional): Maximum height of the video (integer)
- image_1 (required): First input image (string)
- image_2 (required): Second input image (string)
- image_3 (optional): Third input image (optional) (string)
- image_4 (optional): Fourth input image (optional) (string)
- image_5 (optional): Fifth input image (optional) (string)
- image_6 (optional): Sixth input image (optional) (string)
- image_7 (optional): Seventh input image (optional) (string)
- image_8 (optional): Eighth input image (optional) (string)
- image_9 (optional): Ninth input image (optional) (string)
- image_10 (optional): Tenth input image (optional) (string)
- loop (optional): Loop the video (boolean)
- interpolate (optional): Enable 2x interpolation using FILM (boolean)
- color_correction (optional): If the colors are coming out strange, or if the colors between your input images are very different, disable this (boolean)
- seed (optional): Set a seed for reproducibility. Random by default. (integer)


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

### Example (https://replicate.com/p/gw8thp06j1rgp0cfvbtsvrq9vc)

#### Input

```json
{
  "loop": false,
  "prompt": "",
  "image_1": "https://replicate.delivery/pbxt/L1pQdyf4fPVRzU5WxhhHAdH2Eo05X3zhirvNzwAKJ80lA7Qh/replicate-prediction-5cvynz9d91rgg0cfsvqschdpww-0.webp",
  "image_2": "https://replicate.delivery/pbxt/L1pQeBF582rKH3FFAYJCxdFUurBZ1axNFVwKxEd1wIALydhh/replicate-prediction-5cvynz9d91rgg0cfsvqschdpww-1.webp",
  "image_3": "https://replicate.delivery/pbxt/L1pQdTPwSZxnfDkPkM3eArBmHWd5xttTnSkKBhszXJ88pIff/replicate-prediction-5cvynz9d91rgg0cfsvqschdpww-3.webp",
  "max_width": 512,
  "max_height": 512,
  "interpolate": false,
  "negative_prompt": "",
  "color_correction": true
}
```

#### Output

```json
[
  "https://replicate.delivery/pbxt/aDDntBsXmmL6DZMIRURYbxjeer1PZxmT9TIl0MOfqcrYqT1lA/ToonCrafter_00001.mp4"
]
```


## Model readme

> [Follow me on X @fofrAI](https://x.com/fofrAI)
> 
> ## ToonCrafter
> 
> 🤗 ToonCrafter can interpolate two cartoon images by leveraging the pre-trained image-to-video diffusion priors.
> 
> https://github.com/ToonCrafter/ToonCrafter
> 
> ## This model built with ComfyUI
> 
> Built using ComfyUI and Kijai’s custom nodes:
> 
> https://github.com/kijai/ComfyUI-DynamiCrafterWrapper
