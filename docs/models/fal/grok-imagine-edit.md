# Grok Imagine Video

> Edit videos using xAI's Grok Imagine


## Overview

- **Endpoint**: `https://fal.run/xai/grok-imagine-video/edit-video`
- **Model ID**: `xai/grok-imagine-video/edit-video`
- **Category**: video-to-video
- **Kind**: inference
**Tags**: video-edit, v2v, grok, xai



## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_):
  Text description of the desired edit.
  - Examples: "Colorize the video"

- **`video_url`** (`string`, _required_):
  URL of the input video to edit. The video will be resized to a maximum area of 854x480 pixels and truncated to 8 seconds.
  - Examples: "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4"

- **`resolution`** (`ResolutionEnum`, _optional_):
  Resolution of the output video. Default value: `"auto"`
  - Default: `"auto"`
  - Options: `"auto"`, `"480p"`, `"720p"`



**Required Parameters Example**:

```json
{
  "prompt": "Colorize the video",
  "video_url": "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4"
}
```

**Full Example**:

```json
{
  "prompt": "Colorize the video",
  "video_url": "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4",
  "resolution": "auto"
}
```


### Output Schema

The API returns the following output format:

- **`video`** (`VideoFile`, _required_):
  The generated video.
  - Examples: {"height":720,"duration":5.041667,"url":"https://v3b.fal.media/files/b/0a8b9113/EuDrZuQTW9m1phBXOsauz_EpJH3s8X.mp4","fps":24,"width":1280,"file_name":"EuDrZuQTW9m1phBXOsauz_EpJH3s8X.mp4","content_type":"video/mp4","num_frames":121}



**Example Response**:

```json
{
  "video": {
    "height": 720,
    "duration": 5.041667,
    "url": "https://v3b.fal.media/files/b/0a8b9113/EuDrZuQTW9m1phBXOsauz_EpJH3s8X.mp4",
    "fps": 24,
    "width": 1280,
    "file_name": "EuDrZuQTW9m1phBXOsauz_EpJH3s8X.mp4",
    "content_type": "video/mp4",
    "num_frames": 121
  }
}
```


## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/xai/grok-imagine-video/edit-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Colorize the video",
     "video_url": "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4"
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
    "xai/grok-imagine-video/edit-video",
    arguments={
        "prompt": "Colorize the video",
        "video_url": "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4"
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

const result = await fal.subscribe("xai/grok-imagine-video/edit-video", {
  input: {
    prompt: "Colorize the video",
    video_url: "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4"
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

- [Model Playground](https://fal.ai/models/xai/grok-imagine-video/edit-video)
- [API Documentation](https://fal.ai/models/xai/grok-imagine-video/edit-video/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=xai/grok-imagine-video/edit-video)

### fal.ai Platform

- [Platform Documentation](https://docs.fal.ai)
- [Python Client](https://docs.fal.ai/clients/python)
- [JavaScript Client](https://docs.fal.ai/clients/javascript)