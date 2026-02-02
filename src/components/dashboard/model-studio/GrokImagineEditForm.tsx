"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "iconoir-react";
import { logger } from "@/lib/logger";
import {
  buildModelStudioKey,
  readStoredString,
  writeStoredString,
} from "@/lib/modelStudioStorage";
import type { GrokImagineEditResolution } from "@/lib/ai/fal";
import type { GrokImagineEditParameters } from "@/types/studio";

type GrokImagineEditFormProps = {
  modelId: string;
  onSubmit: (parameters: GrokImagineEditParameters) => void;
  isLoading: boolean;
};

const RESOLUTION_OPTIONS: Array<{
  value: GrokImagineEditResolution;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "480p", label: "480p" },
  { value: "720p", label: "720p" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read video file."));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read video file."));
    };
    reader.readAsDataURL(file);
  });
}

function isResolutionOption(value: string): value is GrokImagineEditResolution {
  return RESOLUTION_OPTIONS.some((option) => option.value === value);
}

export function GrokImagineEditForm({
  modelId,
  onSubmit,
  isLoading,
}: GrokImagineEditFormProps) {
  const storageScope = "video-edit";
  const promptKey = buildModelStudioKey(storageScope, modelId, "prompt");
  const resolutionKey = buildModelStudioKey(storageScope, modelId, "resolution");

  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<GrokImagineEditResolution>("auto");
  const [inputVideo, setInputVideo] = useState<string | null>(null);
  const [inputVideoName, setInputVideoName] = useState<string | null>(null);
  const [inputVideoError, setInputVideoError] = useState<string | null>(null);

  const inputVideoRef = useRef<HTMLInputElement>(null);
  const promptValue = prompt.trim();
  const canSubmit = Boolean(promptValue) && Boolean(inputVideo);

  useEffect(() => {
    const errors: string[] = [];
    const promptResult = readStoredString(promptKey);
    if (promptResult.error) errors.push(promptResult.error);

    const resolutionResult = readStoredString(resolutionKey);
    if (resolutionResult.error) errors.push(resolutionResult.error);

    const resolvedResolution =
      resolutionResult.value && isResolutionOption(resolutionResult.value)
        ? resolutionResult.value
        : "auto";

    setPrompt(promptResult.value ?? "");
    setResolution(resolvedResolution);
    setStorageError(errors[0] ?? null);
    setStorageLoaded(true);
  }, [promptKey, resolutionKey]);

  useEffect(() => {
    if (!storageLoaded) return;
    const errors = [
      writeStoredString(promptKey, prompt),
      writeStoredString(resolutionKey, resolution),
    ].filter((value): value is string => typeof value === "string");
    setStorageError(errors[0] ?? null);
  }, [prompt, resolution, promptKey, resolutionKey, storageLoaded]);

  const handleVideoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        const message = "Unsupported file type. Please upload an MP4 video.";
        logger.warn("Grok Imagine edit video rejected", {
          fileName: file.name,
          fileType: file.type,
        });
        setInputVideoError(message);
        if (inputVideoRef.current) {
          inputVideoRef.current.value = "";
        }
        return;
      }

      setInputVideoError(null);
      try {
        const base64 = await fileToBase64(file);
        setInputVideo(base64);
        setInputVideoName(file.name);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to read video file.";
        logger.error("Grok Imagine edit upload failed", {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          error: message,
        });
        setInputVideoError("Failed to read video file.");
      } finally {
        if (inputVideoRef.current) {
          inputVideoRef.current.value = "";
        }
      }
    },
    []
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!promptValue || !inputVideo) {
        if (!inputVideo) {
          setInputVideoError("Input video is required.");
        }
        return;
      }

      const parameters: GrokImagineEditParameters = {
        prompt: promptValue,
        video: inputVideo,
      };
      if (resolution !== "auto") {
        parameters.resolution = resolution;
      }
      onSubmit(parameters);
    },
    [promptValue, inputVideo, resolution, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {storageError && (
        <div className="p-2 bg-destructive/10 border border-destructive/30 rounded">
          <p className="text-[10px] text-destructive">{storageError}</p>
        </div>
      )}

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Prompt</label>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the edit you want to apply..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Resolution</label>
        <select
          value={resolution}
          onChange={(event) => {
            const next = event.target.value;
            if (isResolutionOption(next)) {
              setResolution(next);
            }
          }}
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {RESOLUTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground mt-1">
          Output resolution. Input video is resized and trimmed by the model.
        </p>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Input Video
        </label>
        <input
          ref={inputVideoRef}
          type="file"
          accept="video/mp4"
          onChange={handleVideoUpload}
          className="hidden"
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={() => inputVideoRef.current?.click()}
          disabled={isLoading}
          className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
            inputVideo
              ? "bg-primary/10 border-primary text-primary"
              : "bg-background hover:bg-secondary"
          }`}
        >
          <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
          {inputVideo ? "Change" : "Upload"}
        </button>
        {inputVideo && (
          <div className="mt-2 space-y-1">
            <video
              src={inputVideo}
              controls
              className="w-full h-28 object-contain border border-border bg-muted/20 rounded"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{inputVideoName ?? "Uploaded video"}</span>
              <button
                type="button"
                onClick={() => {
                  setInputVideo(null);
                  setInputVideoName(null);
                  setInputVideoError(null);
                  if (inputVideoRef.current) {
                    inputVideoRef.current.value = "";
                  }
                }}
                className="text-destructive hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        {inputVideoError && (
          <p className="text-[10px] text-destructive mt-1">
            {inputVideoError}
          </p>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Grok Imagine Edit resizes input video to a max of 854×480 and truncates
        to 8 seconds.
      </p>

      <button
        type="submit"
        disabled={isLoading || !canSubmit}
        className="w-full px-3 py-2 text-xs border border-border text-primary hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Processing..." : "Run edit"}
      </button>
    </form>
  );
}
