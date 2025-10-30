export interface MessagingAttachment {
  id: string;
  bucket: string;
  path: string;
  name: string;
  size: number;
  mime_type: string;
}

export interface MessagingParticipant {
  id: string;
  name?: string;
  handle?: string;
  profile_image_url?: string;
}

export interface MessagingThread {
  id: string;
  brand_id: string;
  creator_id: string;
  subject: string;
  last_message: string | null;
  unread_for_brand: boolean;
  unread_for_creator: boolean;
  created_at: string;
  updated_at: string;
  brand?: MessagingParticipant | null;
  creator?: MessagingParticipant | null;
  is_unread: boolean;
}

export interface MessagingMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  attachments: MessagingAttachment[];
  flagged?: boolean;
  flagged_at?: string | null;
  flagged_by?: string | null;
  flagged_reason?: string | null;
  created_at: string;
  sender?: MessagingParticipant | null;
  is_from_current_user: boolean;
}

export interface ThreadPagination {
  limit: number;
  offset: number;
  total: number;
  unread_count: number;
}

export interface MessagePagination {
  limit: number;
  offset: number;
  total: number;
}
