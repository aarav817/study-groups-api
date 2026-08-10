import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  messaging_code: string;
  is_verified?: boolean;
  verification_token?: string | null;
  is_admin?: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface StudyGroup {
  id: string;
  title: string;
  description?: string | null;
  is_public: boolean;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  creator_name?: string;
  creator_email?: string;
  member_count?: number;
  is_member?: boolean;
  user_membership?: GroupMembership | null;
}

export interface GroupMembership {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'host';
  joined_at: Date | string;
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  token: string;
  created_by: string;
  expires_at?: Date | string | null;
  created_at: Date | string;
  invite_url?: string;
}

export interface MaterialFolder {
  id: string;
  group_id: string;
  name: string;
  created_by: string;
  created_at: Date | string;
}

export interface Material {
  id: string;
  group_id?: string | null;
  folder_id?: string | null;
  uploaded_by: string;
  title: string;
  file_format: string;
  file_size_bytes: number | string;
  file_url: string;
  created_at: Date | string;
  uploader_name?: string;
  uploader_avatar?: string | null;
  group_title?: string;
  folder_name?: string | null;
}

export interface Event {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_time: Date | string;
  end_time?: Date | string | null;
  created_at: Date | string;
  group_title?: string;
  creator_name?: string;
  attendee_count?: number;
  is_attending?: boolean;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  created_at: Date | string;
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
}

export interface GroupConversation {
  id: string;
  group_id: string;
  title: string;
  created_by: string;
  created_at: Date | string;
  creator_name?: string;
  message_count?: number;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  conversation_id?: string | null;
  sender_id: string;
  content: string;
  created_at: Date | string;
  sender_name?: string;
  sender_avatar?: string | null;
}

export interface DirectChatRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: Date | string;
  updated_at: Date | string;
  sender_name?: string;
  sender_avatar?: string | null;
  sender_code?: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: Date | string;
  sender_name?: string;
  sender_avatar?: string | null;
  receiver_name?: string;
  receiver_avatar?: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  cached?: boolean;
  cache_source?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
}

// Extend Express Request type
export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}
