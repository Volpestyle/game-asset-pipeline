## Basic model info

Model name: pixverse/pixverse-v5
Model description: Create 5s-8s videos with enhanced character movement, visual effects, and exclusive 1080p-8s support. Optimized for anime characters and complex actions


## Model inputs

- prompt (required): Text prompt for video generation (string)
- image (optional): Image to use for the first frame of the video (string)
- last_frame_image (optional): Use to generate a video that transitions from the first image to the last image. Must be used with image. (string)
- quality (optional): Resolution of the video. 360p and 540p cost the same, but 720p and 1080p cost more. V5 supports 1080p with 8 second duration. (string)
- aspect_ratio (optional): Aspect ratio of the video (string)
- duration (optional): Duration of the video in seconds. 8 second videos cost twice as much as 5 second videos. V5 supports 1080p with 8 second duration. (integer)
- negative_prompt (optional): Negative prompt to avoid certain elements in the video (string)
- seed (optional): Random seed. Set for reproducible generation (integer)
- effect (optional): Special effect to apply to the video. V5 supports effects. Does not work with last_frame_image. (string)


## Model output schema

{
  "type": "string",
  "title": "Output",
  "format": "uri"
}

If the input or output schema includes a format of URI, it is referring to a file.


## Example inputs and outputs

Use these example outputs to better understand the types of inputs the model accepts, and the types of outputs the model returns:

### Example (https://replicate.com/p/gshh0d61vhrm80crxj695gpp3w)

#### Input

```json
{
  "effect": "None",
  "prompt": "A hummingbird frozen mid-flight, iridescent feathers catching golden hour light through morning mist",
  "quality": "1080p",
  "duration": 8,
  "aspect_ratio": "16:9",
  "negative_prompt": ""
}
```

#### Output

```json
"https://replicate.delivery/xezq/cGWRn81blVZGKFocNncx5MHgLtvho90zLaTn3gtQpySLxzTF/tmppcyih9pj.mp4"
```


### Example (https://replicate.com/p/dydwnvr56drme0crxj88jqkvpg)

#### Input

```json
{
  "effect": "None",
  "prompt": "Rooftop garden oasis above a bustling metropolis, city lights twinkling beyond trailing ivy",
  "quality": "1080p",
  "duration": 8,
  "aspect_ratio": "16:9",
  "negative_prompt": ""
}
```

#### Output

```json
"https://replicate.delivery/xezq/ljc6TxrXY1bOLhvnbL3ukFK6T2161ptYcIgLyiFXReNCknnKA/tmp3s3i7nns.mp4"
```


### Example (https://replicate.com/p/dydwnvr56drme0crxj88jqkvpg)

#### Input

```json
{
  "effect": "None",
  "prompt": "Rooftop garden oasis above a bustling metropolis, city lights twinkling beyond trailing ivy",
  "quality": "1080p",
  "duration": 8,
  "aspect_ratio": "16:9",
  "negative_prompt": ""
}
```

#### Output

```json
"https://replicate.delivery/xezq/ljc6TxrXY1bOLhvnbL3ukFK6T2161ptYcIgLyiFXReNCknnKA/tmp3s3i7nns.mp4"
```


### Example (https://replicate.com/p/g00hpvpex1rm80crxj9vk8pzsm)

#### Input

```json
{
  "effect": "None",
  "prompt": "A lone arctic fox curled sleeping on ice floes, aurora borealis dancing overhead",
  "quality": "1080p",
  "duration": 8,
  "aspect_ratio": "16:9",
  "negative_prompt": ""
}
```

#### Output

```json
"https://replicate.delivery/xezq/ZpcwMRwOww7iKJ6f7Tqv9XxXDS9liCOQokaIDbUFwIF7lnnKA/tmp2sgncxf1.mp4"
```


## Model readme

> # PixVerse v5
> 
> PixVerse V5 brings significant improvements to character movement and animation quality. This latest version excels at complex movements like gymnastics, parkour, and martial arts, while delivering enhanced consistency for anime and game characters. V5 introduces visual effects support and is the first version to support high-quality 1080p videos at 8-second duration.
> 
> **Key V5 improvements:**
> - Enhanced character movement for sports, dance, and complex actions
> - Superior anime and game character consistency 
> - Visual effects support with 15+ creative effects
> - Exclusive 1080p + 8-second video generation
> - Improved text stability and rendering quality
> - Better subject clarity and more natural motion
> 
> V5 maintains PixVerse's signature fast generation speed while pushing the boundaries of video quality and creative possibilities.
> 
> ## Privacy policy
> 
> Data from this model is sent from Replicate to PixVerse (MOTIVAI PRIVATE LIMITED).
> 
> Check their Privacy Policy for details:
> 
> https://docs.pixverse.ai/Privacy-Policy-97a21aaf01f646ad968e8f6a0e1a2400
> 
> ## Terms of service
> 
> https://docs.pixverse.ai/PixVerse-Platform-Terms-of-Service-1773e99bf35080c6a802fae0e3629708
