export type ImageModelId =
  | "rd-fast"
  | "rd-plus"
  | "nano-banana-pro"
  | "flux-2-max";

type ImageModelConfig = {
  id: ImageModelId;
  label: string;
  replicateModel: string;
  styles?: string[];
  supportsImg2Img: boolean;
  supportsStrength: boolean;
  supportsPalette: boolean;
  supportsTiling: boolean;
  supportsRemoveBg: boolean;
  supportsSeed: boolean;
  supportsAspectRatio: boolean;
  supportsResolution: boolean;
  supportsPromptExpansion: boolean;
  supportsMultipleImages: boolean;
  maxImageCount: number;
  aspectRatioOptions?: string[];
  resolutionOptions?: string[];
  defaultWidth: number;
  defaultHeight: number;
};

const RD_FAST_STYLES = [
  "default",
  "simple",
  "detailed",
  "retro",
  "game_asset",
  "portrait",
  "texture",
  "ui",
  "item_sheet",
  "character_turnaround",
  "1_bit",
  "low_res",
  "mc_item",
  "mc_texture",
  "no_style",
];

const RD_PLUS_STYLES = [
  "default",
  "retro",
  "watercolor",
  "textured",
  "cartoon",
  "ui_element",
  "item_sheet",
  "character_turnaround",
  "environment",
  "isometric",
  "isometric_asset",
  "topdown_map",
  "topdown_asset",
  "classic",
  "topdown_item",
  "low_res",
  "mc_item",
  "mc_texture",
  "skill_icon",
];

const EMPTY_STYLES: string[] = [];

const IMAGE_MODEL_LIST: ImageModelId[] = [
  "rd-fast",
  "rd-plus",
  "nano-banana-pro",
  "flux-2-max",
];

const IMAGE_MODELS: Record<ImageModelId, ImageModelConfig> = {
  "rd-fast": {
    id: "rd-fast",
    label: "RD Fast",
    replicateModel: "retro-diffusion/rd-fast",
    styles: RD_FAST_STYLES,
    supportsImg2Img: true,
    supportsStrength: true,
    supportsPalette: true,
    supportsTiling: true,
    supportsRemoveBg: true,
    supportsSeed: true,
    supportsAspectRatio: false,
    supportsResolution: false,
    supportsPromptExpansion: true,
    supportsMultipleImages: false,
    maxImageCount: 1,
    defaultWidth: 256,
    defaultHeight: 256,
  },
  "rd-plus": {
    id: "rd-plus",
    label: "RD Plus",
    replicateModel: "retro-diffusion/rd-plus",
    styles: RD_PLUS_STYLES,
    supportsImg2Img: true,
    supportsStrength: true,
    supportsPalette: true,
    supportsTiling: true,
    supportsRemoveBg: true,
    supportsSeed: true,
    supportsAspectRatio: false,
    supportsResolution: false,
    supportsPromptExpansion: true,
    supportsMultipleImages: false,
    maxImageCount: 1,
    defaultWidth: 256,
    defaultHeight: 256,
  },
  "nano-banana-pro": {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    replicateModel: "google/nano-banana-pro",
    supportsImg2Img: true,
    supportsStrength: false,
    supportsPalette: false,
    supportsTiling: false,
    supportsRemoveBg: false,
    supportsSeed: false,
    supportsAspectRatio: true,
    supportsResolution: true,
    supportsPromptExpansion: false,
    supportsMultipleImages: true,
    maxImageCount: 14,
    aspectRatioOptions: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    resolutionOptions: ["1K", "2K", "4K"],
    defaultWidth: 1024,
    defaultHeight: 1024,
  },
  "flux-2-max": {
    id: "flux-2-max",
    label: "FLUX 2 Max",
    replicateModel: "black-forest-labs/flux-2-max",
    supportsImg2Img: true,
    supportsStrength: false,
    supportsPalette: false,
    supportsTiling: false,
    supportsRemoveBg: false,
    supportsSeed: true,
    supportsAspectRatio: true,
    supportsResolution: true,
    supportsPromptExpansion: false,
    supportsMultipleImages: true,
    maxImageCount: 8,
    aspectRatioOptions: [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
      "match_input_image",
    ],
    resolutionOptions: ["0.5 MP", "1 MP", "2 MP", "4 MP", "match_input_image"],
    defaultWidth: 1024,
    defaultHeight: 1024,
  },
};

export function getImageModelConfig(modelId: ImageModelId): ImageModelConfig {
  return IMAGE_MODELS[modelId];
}

export function getImageModelOptions(): Array<{
  value: ImageModelId;
  label: string;
}> {
  return IMAGE_MODEL_LIST.map((id) => ({
    value: id,
    label: IMAGE_MODELS[id].label,
  }));
}

export function getImageModelStyles(modelId: ImageModelId): string[] {
  return IMAGE_MODELS[modelId].styles ?? EMPTY_STYLES;
}

export function getReplicateModelForImage(modelId: ImageModelId): string {
  return IMAGE_MODELS[modelId].replicateModel;
}

export function isValidImageModel(modelId: string): modelId is ImageModelId {
  return IMAGE_MODEL_LIST.includes(modelId as ImageModelId);
}
