export interface AnalyzerBoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AnalyzerDetection {
  issue_type: string;
  confidence: number;
  severity_score: number;
  bounding_box: AnalyzerBoundingBox;
  bounding_boxes?: AnalyzerBoundingBox[];
  raw_class: string;
  model_answer?: string | null;
  frame_timestamp?: number | null;
  matched_latitude?: number | null;
  matched_longitude?: number | null;
  image_width?: number | null;
  image_height?: number | null;
}

export interface AnalyzerDuplicateHint {
  action: string;
  duplicate_score: number;
  incident_id?: string | null;
  reason: string;
}

export interface AnalyzerImageResponse {
  detection: AnalyzerDetection;
  duplicate_hint?: AnalyzerDuplicateHint | null;
  image_width: number;
  image_height: number;
}

export interface AnalyzerVideoResponse {
  detections: AnalyzerDetection[];
  frames_analyzed: number;
  frame_timestamps?: number[];
  sample_fps?: number;
}

export interface AnalyzerStatus {
  ready: boolean;
  loaded?: boolean;
  loading?: boolean;
  engine: string;
  model: string;
  device: string;
  cuda_available?: boolean;
  cuda_device?: string | null;
  generation_mode: string;
  min_confidence: number;
  transformers_version?: string | null;
  error?: string | null;
  last_load_error?: string | null;
}
