export interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface IngestionResult {
  ok: boolean;
  submissionId: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  metrics?: VideoMetrics;
  error?: string;
  errorCode?: string;
}

export type IngestionPlatform = 'youtube' | 'tiktok' | 'instagram';
