export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string;
  type: 'text' | 'image' | 'file';
  status: 'sent' | 'delivered' | 'seen';
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
}

export interface Chat {
  id: number;
  type: 'private' | 'group';
  name?: string;
  created_at: string;
  last_message?: string;
  last_message_time?: string;
  participants: User[];
}
