"use client";

import { useState, useCallback, useRef } from "react";
import { Upload } from "iconoir-react";
import {
  getVideoModelConfig,
  getVideoSizeOptions,
  getVideoSecondsOptions,
  type VideoModelId,
} from "@/lib/ai/soraConstraints";

type VideoModelFormProps = {
  modelId: string;
  onSubmit: (parameters: Record<string, unknown>) => void;
  isLoading: boolean;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function VideoModelForm({
  modelId,
  onSubmit,
  isLoading,
}: VideoModelFormProps) {
  const config = getVideoModelConfig(modelId);
  const sizeOptions = getVideoSizeOptions(modelId);
  const secondsOptions = getVideoSecondsOptions(modelId);

  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(sizeOptions[0] ?? "1280x720");
  const [seconds, setSeconds] = useState(secondsOptions[0] ?? 4);
  const [startImage, setStartImage] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);

  const startImageRef = useRef<HTMLInputElement>(null);
  const endImageRef = useRef<HTMLInputElement>(null);

  const handleStartImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const base64 = await fileToBase64(file);
        setStartImage(base64);
      }
    },
    []
  );

  const handleEndImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const base64 = await fileToBase64(file);
        setEndImage(base64);
      }
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;

      const parameters: Record<string, unknown> = {
        prompt: prompt.trim(),
        size,
        seconds,
      };

      if (startImage) {
        parameters.startImage = startImage;
      }
      if (endImage && config.supportsStartEnd) {
        parameters.endImage = endImage;
      }
      if (config.supportsLoop) {
        parameters.loop = loop;
      }
      if (config.replicateSupportsAudio) {
        parameters.generateAudio = generateAudio;
      }

      onSubmit(parameters);
    },
    [
      prompt,
      size,
      seconds,
      startImage,
      endImage,
      loop,
      generateAudio,
      config,
      onSubmit,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to generate..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Size
          </label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {sizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Duration
          </label>
          <select
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {secondsOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}s
              </option>
            ))}
          </select>
        </div>
      </div>

      {config.supportsStartEnd && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Start Image
            </label>
            <input
              ref={startImageRef}
              type="file"
              accept="image/*"
              onChange={handleStartImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => startImageRef.current?.click()}
              className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
                startImage
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
              {startImage ? "Uploaded" : "Upload"}
            </button>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              End Image
            </label>
            <input
              ref={endImageRef}
              type="file"
              accept="image/*"
              onChange={handleEndImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => endImageRef.current?.click()}
              className={`w-full px-3 py-2 text-xs border border-border rounded flex items-center justify-center gap-2 transition-colors ${
                endImage
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
              {endImage ? "Uploaded" : "Upload"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-4">
        {config.supportsLoop && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Loop
          </label>
        )}

        {config.replicateSupportsAudio && (
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={generateAudio}
              onChange={(e) => setGenerateAudio(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Generate Audio
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !prompt.trim()}
        className="w-full px-4 py-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "GENERATING..." : "GENERATE VIDEO"}
      </button>
    </form>
  );
}
