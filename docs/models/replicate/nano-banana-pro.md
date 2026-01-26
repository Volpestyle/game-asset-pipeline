## Basic model info

Model name: google/nano-banana-pro
Model description: Google's state of the art image generation and editing model 🍌🍌


## Model inputs

- prompt (required): A text description of the image you want to generate (string)
- image_input (optional): Input images to transform or use as reference (supports up to 14 images) (array)
- aspect_ratio (optional): Aspect ratio of the generated image (string)
- resolution (optional): Resolution of the generated image (string)
- output_format (optional): Format of the output image (string)
- safety_filter_level (optional): block_low_and_above is strictest, block_medium_and_above blocks some prompts, block_only_high is most permissive but some prompts will still be blocked (string)


## Model output schema

{
  "type": "string",
  "title": "Output",
  "format": "uri"
}

If the input or output schema includes a format of URI, it is referring to a file.


## Example inputs and outputs

Use these example outputs to better understand the types of inputs the model accepts, and the types of outputs the model returns:

### Example (https://replicate.com/p/67tcx1ssmnrm80ctm71963g6f4)

#### Input

```json
{
  "prompt": "35.6586\u00b0 N, 139.7454\u00b0 E at 19:00",
  "resolution": "2K",
  "image_input": [],
  "aspect_ratio": "4:3",
  "output_format": "png",
  "safety_filter_level": "block_only_high"
}
```

#### Output

```json
"https://replicate.delivery/xezq/r9jDvpiCpZ4UPpepWZTfVwd8klFwgAiWRHfUfJZf9JLT2uZtC/tmpexa0dvov.png"
```


### Example (https://replicate.com/p/cx23k6jpgnrmc0ctm7cvzk0s3m)

#### Input

```json
{
  "prompt": "How engineers see the San Francisco Bridge",
  "resolution": "2K",
  "image_input": [],
  "aspect_ratio": "4:3",
  "output_format": "png",
  "safety_filter_level": "block_only_high"
}
```

#### Output

```json
"https://replicate.delivery/xezq/Z0tgPisAiYZZL9F59w7kIGdRY7w0YPS7fJ9VyWga2jZ3Hn1KA/tmp66pw609z.png"
```


### Example (https://replicate.com/p/q8m1sh0drxrme0ctm7gtt26sjw)

#### Input

```json
{
  "prompt": "Show happens to the egg if you add a lot of salt in the water",
  "resolution": "2K",
  "image_input": [
    "https://replicate.delivery/pbxt/O5zNuRklFLRFRVukiwCrJxTBxJppT8DxtawxYQaVsCSEzruK/egg.jpg"
  ],
  "aspect_ratio": "4:3",
  "output_format": "png",
  "safety_filter_level": "block_only_high"
}
```

#### Output

```json
"https://replicate.delivery/xezq/AhXs2axNZ7JXJRvDottEOV6tKIJfazVqLHLfTSJcEZ1UWOrVA/tmpxve4_v3x.png"
```


### Example (https://replicate.com/p/4paeeta6rnrme0ctm87r73pgsw)

#### Input

```json
{
  "prompt": "pull real time weather to build a pop art infographic for Washington D.C",
  "resolution": "2K",
  "image_input": [],
  "aspect_ratio": "4:3",
  "output_format": "png",
  "safety_filter_level": "block_only_high"
}
```

#### Output

```json
"https://replicate.delivery/xezq/ucsY1Zru026yAVdrPvNhOinr2MGQpoyW78tfCeh1ysd1FPrVA/tmpk4e1qvro.png"
```


### Example (https://replicate.com/p/er2a0csngdrma0ctm8baptpgsm)

#### Input

```json
{
  "prompt": "rare.jpg",
  "resolution": "1K",
  "image_input": [],
  "aspect_ratio": "4:3",
  "output_format": "jpg",
  "safety_filter_level": "block_only_high"
}
```

#### Output

```json
"https://replicate.delivery/xezq/piAS0s9DshbqMFXJvIfw9feWaEaNsejlRifhVgMSflvZJzzaF/tmp3u2ym4f_.jpeg"
```


### Example (https://replicate.com/p/1rd9xb7m25rmc0ctm9e969j7gw)

#### Input

```json
{
  "prompt": "an office team photo, everyone making a silly face",
  "resolution": "2K",
  "image_input": [
    "https://replicate.delivery/pbxt/O61OKYNMCfhPTvuTf6SdRVwNlIpoKMeQPQw5WygFtvDwhWgh/guy.webp",
    "https://replicate.delivery/pbxt/O61OK9ETMHHJO5m0qlCkGLhr5lcmbZ08U42C8PWLd4uszDQr/bob-ross.png",
    "https://replicate.delivery/pbxt/O61OKPSxpwgO83SLFGenwEcGNdEAirtw26cIfvuIxz8FeTvf/jennai.jpg",
    "https://replicate.delivery/pbxt/O61OKGAI2lrcNy9I4tpUB4RPbsBUjcaxAjYjVlxRBHc2aIgK/01.webp",
    "https://replicate.delivery/pbxt/O61OKEMaqM46GAnoSwzDpZJRmo922lNZELRUZo3lr4MWMG7x/podcast-woman.png",
    "https://replicate.delivery/pbxt/O61S8cEIMPpMwEOkXnrroou1JkzoVFa0JJuhXHt05hBQ8AUq/replicate-prediction-50s6t1510hrma0ct2v5vj7jk2m.jpg"
  ],
  "aspect_ratio": "4:3",
  "output_format": "png",
  "safety_filter_level": "block_only_high"
}
```

#### Output

```json
"https://replicate.delivery/xezq/JACsWhU1EWoJIZ4OunufCh2kkixbJIl7sW8vtFjGZ8x3Ko1KA/tmpt2fb5g_i.png"
```


## Model readme

> # Nano Banana Pro
> 
> Generate and edit images with accurate text, advanced reasoning, and professional-grade creative controls.
> 
> Nano Banana Pro is Google DeepMind's image generation and editing model built on Gemini 3 Pro. It creates detailed visuals with legible text in multiple languages, connects to real-time information from Google Search, and gives you studio-quality control over every aspect of your images.
> 
> ## What can you do with it
> 
> **Create images with accurate, legible text**
> 
> Nano Banana Pro is particularly good at rendering text directly in images. You can generate posters, mockups, infographics, and diagrams with clear typography in multiple languages. The model understands depth and nuance, so it can create text with varied textures, fonts, and calligraphy styles.
> 
> **Generate context-rich visuals from real-world knowledge**
> 
> The model uses Gemini 3 Pro's reasoning capabilities to create accurate educational content, infographics, and diagrams. It can connect to Google Search to pull in real-time information like recipes, weather data, or sports scores, then visualize that information for you.
> 
> **Blend multiple images with consistent results**
> 
> You can combine up to 14 images in a single composition while maintaining consistency and resemblance of up to 5 people. This makes it useful for turning sketches into products, creating lifestyle scenes, or building surreal compositions from multiple elements.
> 
> **Exercise professional creative control**
> 
> Nano Banana Pro offers advanced editing capabilities that let you adjust camera angles, change scene lighting (like turning day into night), apply color grading, modify depth of field, and edit specific parts of an image while keeping everything else intact. You can generate images in various aspect ratios and at resolutions up to 4K.
> 
> ## Example uses
> 
> **Typography and branding**
> 
> Create logos where letters convey meaning visually, generate posters with retro screen-printed textures, or build city scenes where buildings form letters that spell words.
> 
> **Multilingual content**
> 
> Generate text in one language, then translate it to another while keeping all other visual elements the same. This helps you localize marketing materials, posters, or product packaging.
> 
> **Educational content**
> 
> Turn handwritten notes into diagrams, create step-by-step infographics for recipes or tutorials, or generate detailed educational explainers about plants, animals, or other subjects.
> 
> **Product mockups and prototypes**
> 
> Blend sketches with product photos, create photorealistic renderings from blueprints, or generate lifestyle product shots with consistent branding across different settings.
> 
> **Creative transformations**
> 
> Change the aspect ratio of an image while keeping subjects in position, apply dramatic lighting effects, shift focus to specific elements, or transform the mood by adjusting time of day and atmosphere.
> 
> ## How it works
> 
> Nano Banana Pro uses Gemini 3 Pro's advanced reasoning and real-world knowledge to understand what you want to create. When you provide a prompt, the model considers context, spatial relationships, composition, and style to generate images that match your intent. Its multilingual capabilities come from Gemini 3 Pro's enhanced language understanding, which helps it render accurate text across different writing systems.
> 
> The model can access Google Search when you need current information or specific facts, making it more accurate for data-driven visualizations and infographics.
> 
> ## Things to keep in mind
> 
> Like all large language models, Nano Banana Pro may sometimes produce inaccurate or unexpected results. When generating infographics or data visualizations, verify the factual accuracy of the output. Text generation is strong across many languages, but you might occasionally see issues with grammar, spelling, or cultural nuances in specific languages.
> 
> Advanced features like masked editing, major lighting changes, or blending many images can sometimes produce visual artifacts or unnatural results. Character consistency is generally reliable but not perfect every time.
> 
> All images generated by Nano Banana Pro include SynthID watermarks, Google's imperceptible digital watermarking technology for identifying AI-generated content.
> 
> ## Try it yourself
> 
> You can try Nano Banana Pro on the [Replicate Playground](https://replicate.com/playground)
> 
> Try out the other [Google models here](https://replicate.com/google)
