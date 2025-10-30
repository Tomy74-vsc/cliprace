// Types pour les APIs
export interface LeaderboardData {
  id: string;
  contest_id: string;
  submission_id: string;
  rank: number;
  score: number;
  last_updated: string;
  submissions: {
    id: string;
    creator_id: string;
    video_url: string;
    platform: string;
    platform_video_id: string;
    status: string;
    created_at: string;
    profiles: {
      id: string;
      name: string;
      handle: string;
      profile_image_url: string;
    };
  };
  contests: {
    id: string;
    title: string;
    status: string;
  };
}

export interface NotificationData {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface MessageData {
  id: string;
  brand_id: string;
  creator_id: string;
  subject: string;
  last_message: string;
  unread_for_brand: boolean;
  unread_for_creator: boolean;
  created_at: string;
  updated_at: string;
  profiles_brand: {
    id: string;
    name: string;
    handle: string;
    profile_image_url: string;
  };
  profiles_creator: {
    id: string;
    name: string;
    handle: string;
    profile_image_url: string;
  };
}

export interface MessageThreadData {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  attachments: any[];
  created_at: string;
  profiles: {
    id: string;
    name: string;
    handle: string;
    profile_image_url: string;
  };
}

export interface SignatureData {
  id: string;
  submission_id: string;
  signed_by: string;
  signed_at: string;
  signature_meta: Record<string, any>;
  submissions: {
    id: string;
    contest_id: string;
    creator_id: string;
    video_url: string;
    platform: string;
    platform_video_id: string;
    status: string;
    profiles: {
      id: string;
      name: string;
      handle: string;
      profile_image_url: string;
    };
    contests: {
      id: string;
      title: string;
      brand_id: string;
    };
  };
  profiles: {
    id: string;
    name: string;
    handle: string;
    profile_image_url: string;
  };
}

export interface LeaderboardItem {
  rank: number;
  score: number;
  submissions: {
    platform: string;
    profiles: {
      name: string;
      handle: string;
    };
  };
}
