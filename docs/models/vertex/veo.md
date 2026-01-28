## Vertex Veo (overview)

Vertex AI hosts Google Veo models. This doc focuses on the video continuation (extend) workflow that we use for segmented generation.

## Supported model IDs (continuation)

- veo-3.1-generate-preview
- veo-3.1-fast-generate-preview

Notes:
- Veo 3.1 generate preview models support extend.
- Non-preview Veo 3.1 generate models do not support extend.

## Continuation constraints

- Input must be MP4.
- Input duration must be between 1 and 30 seconds.
- Input must be 24 FPS.
- Input resolution must be 720p or 1080p.
- Aspect ratio must be 16:9 or 9:16.
- Output is a fixed 7 second continuation at 24 FPS and 720p.
- Extend operates on a previously generated Veo video.

Notes:
- parameters.storageUri is optional; when omitted the response can include inline bytes.
- The extend docs list output resolution as 720p even though resolution is an input parameter for Veo 3 models (720p/1080p, and 4k for Veo 3.1 preview). Verify output resolution before relying on it.

## REST endpoint

Use the Vertex AI predictLongRunning endpoint for the preview models:

```
POST https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{modelId}:predictLongRunning
```

Minimal request shape:

```json
{
  "instances": [
    {
      "prompt": "Continue the motion...",
      "video": {
        "gcsUri": "gs://bucket/object.mp4"
      }
    }
  ],
  "parameters": {
    "storageUri": "gs://bucket/output/",
    "aspectRatio": "16:9",
    "resolution": "720p",
    "sampleCount": 1
  }
}
```

## App integration notes

- Continuation is explicit in Animation Settings. Select the Vertex AI provider, choose a Veo 3.1 preview model, enable continuation, and upload an MP4 to extend.
- Continuation uses the uploaded video as the input clip; start/end frame controls are not used.
- Set VERTEX_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) and credentials (GOOGLE_APPLICATION_CREDENTIALS).
- VERTEX_LOCATION defaults to us-central1.
- VEO_CONTINUATION_BUCKET (optional) uploads the input video to GCS; otherwise inline base64 is used.

References:
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/extend-a-veo-video
- https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-3-1-generate
