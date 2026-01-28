# Pika

> Discover ultimate control with Pikaframes key frame interpolation, a stunning image-to-video feature that allows you to upload up to 5 keyframes, customize their transition length and prompt, and see their images come to life as seamless videos.


## Overview

- **Endpoint**: `https://fal.run/fal-ai/pika/v2.2/pikaframes`
- **Model ID**: `fal-ai/pika/v2.2/pikaframes`
- **Category**: image-to-video
- **Kind**: inference


## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`image_urls`** (`list<string>`, _required_):
  URLs of keyframe images (2-5 images) to create transitions between
  - Array of string
  - Examples: ["https://v3b.fal.media/files/b/tiger/-YohU0xcPcWe_eiUB9_i6_keyframes-apple-start.png","https://v3b.fal.media/files/b/tiger/LarvwQGEFqEmF8fkgDB8R_keyframes-apple-end.png"]

- **`transitions`** (`list<KeyframeTransition>`, _optional_):
  Configuration for each transition. Length must be len(image_urls) - 1. Total duration of all transitions must not exceed 25 seconds. If not provided, uses default 5-second transitions with the global prompt.
  - Array of KeyframeTransition

- **`prompt`** (`string`, _optional_):
  Default prompt for all transitions. Individual transition prompts override this.
  - Examples: "smooth cinematic transition", "seamless blend between scenes"

- **`negative_prompt`** (`string`, _optional_):
  A negative prompt to guide the model Default value: `""`
  - Default: `""`

- **`seed`** (`integer`, _optional_):
  The seed for the random number generator

- **`resolution`** (`ResolutionEnum`, _optional_):
  The resolution of the generated video Default value: `"720p"`
  - Default: `"720p"`
  - Options: `"720p"`, `"1080p"`
  - Examples: "1080p", "720p"



**Required Parameters Example**:

```json
{
  "image_urls": [
    "https://v3b.fal.media/files/b/tiger/-YohU0xcPcWe_eiUB9_i6_keyframes-apple-start.png",
    "https://v3b.fal.media/files/b/tiger/LarvwQGEFqEmF8fkgDB8R_keyframes-apple-end.png"
  ]
}
```

**Full Example**:

```json
{
  "image_urls": [
    "https://v3b.fal.media/files/b/tiger/-YohU0xcPcWe_eiUB9_i6_keyframes-apple-start.png",
    "https://v3b.fal.media/files/b/tiger/LarvwQGEFqEmF8fkgDB8R_keyframes-apple-end.png"
  ],
  "prompt": "smooth cinematic transition",
  "resolution": "1080p"
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`File`, _required_):
  The generated video with transitions between keyframes
  - Examples: {"file_size":1583228,"file_name":"tmpjfwlno11.mp4","content_type":"video/mp4","url":"https://v3b.fal.media/files/b/lion/0KxHFdw-mp0OzGsLrQLIy_tmpjfwlno11.mp4"}



**Example Response**:

```json
{
  "video": {
    "file_size": 1583228,
    "file_name": "tmpjfwlno11.mp4",
    "content_type": "video/mp4",
    "url": "https://v3b.fal.media/files/b/lion/0KxHFdw-mp0OzGsLrQLIy_tmpjfwlno11.mp4"
  }
}
```


## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/pika/v2.2/pikaframes \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "image_urls": [
       "https://v3b.fal.media/files/b/tiger/-YohU0xcPcWe_eiUB9_i6_keyframes-apple-start.png",
       "https://v3b.fal.media/files/b/tiger/LarvwQGEFqEmF8fkgDB8R_keyframes-apple-end.png"
     ]
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/pika/v2.2/pikaframes",
    arguments={
        "image_urls": ["https://v3b.fal.media/files/b/tiger/-YohU0xcPcWe_eiUB9_i6_keyframes-apple-start.png", "https://v3b.fal.media/files/b/tiger/LarvwQGEFqEmF8fkgDB8R_keyframes-apple-end.png"]
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/pika/v2.2/pikaframes", {
  input: {
    image_urls: ["https://v3b.fal.media/files/b/tiger/-YohU0xcPcWe_eiUB9_i6_keyframes-apple-start.png", "https://v3b.fal.media/files/b/tiger/LarvwQGEFqEmF8fkgDB8R_keyframes-apple-end.png"]
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/pika/v2.2/pikaframes)
- [API Documentation](https://fal.ai/models/fal-ai/pika/v2.2/pikaframes/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/pika/v2.2/pikaframes)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)