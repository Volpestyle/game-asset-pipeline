## Basic model info

Model name: google/veo-3.1-fast
Model description: New and improved version of Veo 3 Fast, with higher-fidelity video, context-aware audio and last frame support


## Model inputs

- prompt (required): Text prompt for video generation (string)
- aspect_ratio (optional): Video aspect ratio (string)
- duration (optional): Video duration in seconds (integer)
- image (optional): Input image to start generating from. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose. (string)
- last_frame (optional): Ending image for interpolation. When provided with an input image, creates a transition between the two images. (string)
- negative_prompt (optional): Description of what to exclude from the generated video (string)
- resolution (optional): Resolution of the generated video (string)
- generate_audio (optional): Generate audio with the video (boolean)
- seed (optional): Random seed. Omit for random generations (integer)


## Model output schema

{
  "type": "string",
  "title": "Output",
  "format": "uri"
}

If the input or output schema includes a format of URI, it is referring to a file.


## Example inputs and outputs

Use these example outputs to better understand the types of inputs the model accepts, and the types of outputs the model returns:

### Example (https://replicate.com/p/btfhsk0brdrme0cswz1svpa1t0)

#### Input

```json
{
  "image": "https://replicate.delivery/pbxt/NtA24zy4mLgKWNrWNeA0oo7vYtfBrlqekDg9YzvYME7DWviD/replicate-prediction-jthe403h69rm80cswygbz19zv4.jpeg",
  "prompt": "The camera zooms right into her eye, focuses, then zooms all the way back again (no cross fade)",
  "duration": 8,
  "last_frame": "https://replicate.delivery/pbxt/NtA25IqhAytam2wvnJB1aEteldVkJfDfUNBbQVb6pvRpGNIJ/replicate-prediction-jthe403h69rm80cswygbz19zv4.jpeg",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "generate_audio": true
}
```

#### Output

```json
"https://replicate.delivery/xezq/aOYeXeCcnHhDiELUfr7GJR0IkfcGabYRUWiTShhvdJCTEQ9VB/tmpafbwmta5.mp4"
```


### Example (https://replicate.com/p/7deqgxa70hrmc0csx1ksx53g3g)

#### Input

```json
{
  "prompt": "a cat steals a fish from a supermarket and escapes",
  "duration": 8,
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "generate_audio": true
}
```

#### Output

```json
"https://replicate.delivery/xezq/1B4tYHYfzWzDA6QU9CEDxkCnStf8YeysV0TlfnKktgG3la9VB/tmpyxaslbuk.mp4"
```


### Example (https://replicate.com/p/s590kfybdxrm80csx1r8yvhf5c)

#### Input

```json
{
  "image": "https://replicate.delivery/pbxt/NtCvvHA8b8QSOKLIQgoCr7RzB9vbqFOrLhGwR8UVBrrWgOc2/replicate-prediction-3vtcmk5955rm80csx1qt7mc7s8.jpeg",
  "prompt": "the seed slowly starts to spin, faster and faster as it morphs into a whole watermelon",
  "duration": 8,
  "last_frame": "https://replicate.delivery/pbxt/NtCvvggprebHqMWEhzJ9SEG9yl3UUt7jzt4wpfkz5z7yfAUB/replicate-prediction-hsxsc8j6s9rme0csx1ra7f293m.jpeg",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "generate_audio": true
}
```

#### Output

```json
"https://replicate.delivery/xezq/Z3Ix0cUxzkqcL18AfbOu0B5pXJFfsqfscQQzenO288McMb9VB/tmp2vogi5sn.mp4"
```


### Example (https://replicate.com/p/9y7jqn5byxrm80csx2083y5he4)

#### Input

```json
{
  "image": "https://replicate.delivery/pbxt/NtDCMBJNIQTOU0mZtlnlrqrPLgYvTvpCISbFIiweYPsotGY5/replicate-prediction-gn4tnddn5drme0csx1yt3jvy4c.jpeg",
  "prompt": "Overlapping geometric shapes, pulsing to upbeat electronic music with SFX of shifting patterns",
  "duration": 8,
  "last_frame": "https://replicate.delivery/pbxt/NtDCLnwTQaPfLhgaNDmLevN8QivDFS8V91M8pCwEpDNIN9uA/replicate-prediction-8m82ekaj7hrma0csx1xrkmqjhm.jpeg",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "generate_audio": true
}
```

#### Output

```json
"https://replicate.delivery/xezq/8ZOMlNOoESqDDZXc9SwJNselA7lTLS1MBx3HgSx0lTzwhrvKA/tmpyid0s5l4.mp4"
```


## Model readme

> No readme available for this model.

---

## Continuation (Vertex AI)

Veo continuation (video extend) is **not** exposed via Replicate. Google provides this feature through Vertex AI using the Veo 3.1 preview models.

Key constraints for Vertex continuation:
- Input video must be MP4, 1-30 seconds, 24 FPS, and either 720p or 1080p in 16:9 or 9:16.
- Output is fixed at 7 seconds, 24 FPS, and 720p.
- Video input is mutually exclusive with image + last-frame conditioning.

App integration notes:
- Continuation runs through the Vertex AI provider (preview models). Select Vertex AI in Animation Settings, enable continuation, and upload the source MP4.
- Provide Vertex credentials (for example GOOGLE_APPLICATION_CREDENTIALS) and a project ID via VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT.
- If VEO_CONTINUATION_BUCKET is set, inputs are uploaded to GCS; otherwise inline base64 video is used.

Reference: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/extend-a-veo-video
