/**
 * Supabase Types Configuration
 * 
 * This file provides type definitions for Supabase client
 * to resolve TypeScript compilation issues
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type Database = {
  public: {
    Tables: {
      submissions: {
        Row: {
          id: string;
          contest_id: string;
          creator_id: string;
          network: string;
          platform_video_id: string | null;
          video_url: string;
          content_url: string | null;
          thumbnail_url: string | null;
          status: string;
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
          network: string;
          platform_video_id?: string | null;
          video_url: string;
          content_url?: string | null;
          thumbnail_url?: string | null;
          status?: string;
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
          network?: string;
          platform_video_id?: string | null;
          video_url?: string;
          content_url?: string | null;
          thumbnail_url?: string | null;
          status?: string;
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
    };
  };
};

export type SupabaseClientType = SupabaseClient<Database>;
