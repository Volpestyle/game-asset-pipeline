"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Xmark } from "iconoir-react";

type ToonCrafterFormProps = {
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

export function ToonCrafterForm({ onSubmit, isLoading }: ToonCrafterFormProps) {
  const [prompt, setPrompt] = useState("");
  const [keyframes, setKeyframes] = useState<string[]>([]);
  const [maxWidth, setMaxWidth] = useState(512);
  const [maxHeight, setMaxHeight] = useState(512);
  const [loop, setLoop] = useState(false);
  const [interpolate, setInterpolate] = useState(false);
  const [colorCorrection, setColorCorrection] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [seed, setSeed] = useState<number | "">("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyframeUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newKeyframes: string[] = [];
      for (let i = 0; i < files.length; i++) {
        if (keyframes.length + newKeyframes.length >= 10) break;
        const base64 = await fileToBase64(files[i]);
        newKeyframes.push(base64);
      }

      setKeyframes((prev) => [...prev, ...newKeyframes].slice(0, 10));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [keyframes.length]
  );

  const removeKeyframe = useCallback((index: number) => {
    setKeyframes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (keyframes.length < 2) return;

      const parameters: Record<string, unknown> = {
        prompt: prompt.trim(),
        keyframes,
        maxWidth,
        maxHeight,
        loop,
        interpolate,
        colorCorrection,
      };

      if (negativePrompt.trim()) {
        parameters.negativePrompt = negativePrompt.trim();
      }

      if (typeof seed === "number" && Number.isFinite(seed)) {
        parameters.seed = seed;
      }

      onSubmit(parameters);
    },
    [
      prompt,
      keyframes,
      maxWidth,
      maxHeight,
      loop,
      interpolate,
      colorCorrection,
      negativePrompt,
      seed,
      onSubmit,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Prompt (optional)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the animation (or leave empty)..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground">
            Keyframes ({keyframes.length}/10)
          </label>
          {keyframes.length < 10 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-primary hover:underline"
            >
              Add
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleKeyframeUpload}
          className="hidden"
        />

        {keyframes.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-3 py-4 text-xs border border-dashed border-border rounded flex flex-col items-center justify-center gap-2 transition-colors hover:bg-secondary"
          >
            <Upload className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-muted-foreground">
              Upload 2-10 keyframe images
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {keyframes.map((kf, index) => (
              <div key={index} className="relative group">
                <img
                  src={kf}
                  alt={`Keyframe ${index + 1}`}
                  className="w-full aspect-square object-cover border border-border rounded"
                />
                <button
                  type="button"
                  onClick={() => removeKeyframe(index)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Xmark className="w-3 h-3" strokeWidth={2} />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/50 py-0.5">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        )}
        {keyframes.length > 0 && keyframes.length < 2 && (
          <p className="text-[10px] text-destructive mt-1">
            Minimum 2 keyframes required
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Max Width
          </label>
          <input
            type="number"
            value={maxWidth}
            onChange={(e) => setMaxWidth(Number(e.target.value))}
            min={128}
            max={768}
            step={8}
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Max Height
          </label>
          <input
            type="number"
            value={maxHeight}
            onChange={(e) => setMaxHeight(Number(e.target.value))}
            min={128}
            max={768}
            step={8}
            className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Loop
        </label>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={interpolate}
            onChange={(e) => setInterpolate(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Interpolate
        </label>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={colorCorrection}
            onChange={(e) => setColorCorrection(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Color Correction
        </label>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Negative Prompt (optional)
        </label>
        <input
          type="text"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="Things to avoid..."
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Seed (optional)
        </label>
        <input
          type="number"
          value={seed}
          onChange={(e) =>
            setSeed(e.target.value ? Number(e.target.value) : "")
          }
          placeholder="Random"
          className="w-full px-3 py-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || keyframes.length < 2}
        className="w-full px-4 py-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "GENERATING..." : "GENERATE VIDEO"}
      </button>
    </form>
  );
}
