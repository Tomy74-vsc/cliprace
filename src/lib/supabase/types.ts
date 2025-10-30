/**
 * Optimized Supabase Types for Metrics Collection
 * 
 * Provides type-safe interfaces for all database operations
 * with proper error handling and performance optimizations
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Base database schema types
export interface Database {
  public: {
    Tables: {
      submissions: {
        Row: {
          id: string;
          contest_id: string;
          creator_id: string;
          network: 'youtube' | 'tiktok' | 'instagram';
          platform_video_id: string | null;
          video_url: string;
          content_url: string | null;
          thumbnail_url: string | null;
          status: 'pending' | 'approved' | 'rejected';
          reason: string | null;
          moderated_at: string | null;
          moderated_by: string | null;
          views: number;
          likes: number;
          comments: number;
          shares: number;
          engagement_rate: number;
          posted_at: string | null;
          created_at: string;
          updated_at: string;
          last_metrics_fetch: string | null;
          meta: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          contest_id: string;
          creator_id: string;
          network: 'youtube' | 'tiktok' | 'instagram';
          platform_video_id?: string | null;
          video_url: string;
          content_url?: string | null;
          thumbnail_url?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          reason?: string | null;
          moderated_at?: string | null;
          moderated_by?: string | null;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          engagement_rate?: number;
          posted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          last_metrics_fetch?: string | null;
          meta?: Record<string, unknown>;
        };
        Update: {
          id?: string;
          contest_id?: string;
          creator_id?: string;
          network?: 'youtube' | 'tiktok' | 'instagram';
          platform_video_id?: string | null;
          video_url?: string;
          content_url?: string | null;
          thumbnail_url?: string | null;
          status?: 'pending' | 'approved' | 'rejected';
          reason?: string | null;
          moderated_at?: string | null;
          moderated_by?: string | null;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          engagement_rate?: number;
          posted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          last_metrics_fetch?: string | null;
          meta?: Record<string, unknown>;
        };
      };
      metrics_daily: {
        Row: {
          id: string;
          submission_id: string;
          date: string;
          views: number;
          likes: number;
          comments: number;
          shares: number;
          engagement_rate: number;
          views_change: number;
          likes_change: number;
          comments_change: number;
          shares_change: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          submission_id: string;
          date: string;
          views: number;
          likes: number;
          comments: number;
          shares: number;
          engagement_rate: number;
          views_change?: number;
          likes_change?: number;
          comments_change?: number;
          shares_change?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submission_id?: string;
          date?: string;
          views?: number;
          likes?: number;
          comments?: number;
          shares?: number;
          engagement_rate?: number;
          views_change?: number;
          likes_change?: number;
          comments_change?: number;
          shares_change?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          role: 'creator' | 'brand' | 'admin';
          name: string;
          social_media: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: 'creator' | 'brand' | 'admin';
          name: string;
          social_media?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'creator' | 'brand' | 'admin';
          name?: string;
          social_media?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Optimized Supabase client type
export type SupabaseClientType = SupabaseClient<Database>;

// Submission processing types
export interface SubmissionToProcess {
  id: string;
  platform_video_id: string;
  network: 'youtube' | 'tiktok' | 'instagram';
  creator_id: string;
  last_metrics_fetch: string | null;
  meta: Record<string, unknown>;
}

// Metrics result types
export interface MetricsResult {
  submission_id: string;
  success: boolean;
  metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    duration_seconds: number;
  };
  error?: string;
  platform: string;
}

// Platform-specific metric types
export interface PlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  duration_seconds: number;
}

// Error handling types
export interface ProcessingError {
  code: string;
  message: string;
  platform: string;
  submission_id: string;
  timestamp: string;
}

// Rate limiting configuration
export interface RateLimitConfig {
  youtube: number;
  tiktok: number;
  instagram: number;
}

// Refresh interval configuration
export interface RefreshIntervalConfig {
  youtube: number; // minutes
  tiktok: number;  // minutes
  instagram: number; // minutes
}

// Webhook payload types
export interface WebhookPayload {
  platform: string;
  video_id: string;
  metrics: PlatformMetrics;
  timestamp: string;
  signature?: string;
}

// Database operation result types
export interface DatabaseResult<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Metrics collection configuration
export interface MetricsConfig {
  rateLimits: RateLimitConfig;
  refreshIntervals: RefreshIntervalConfig;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
}

// Supabase configuration
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// User and Session types
export interface User {
  id: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: User;
}