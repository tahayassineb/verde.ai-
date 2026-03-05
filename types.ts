export interface User {
  id: string;
  phone_number: string;
  full_name?: string;
  subscription?: any;
}

export interface Session {
  id: string;
  user_id: string;
  session_name: string;
  phone_number: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'need_scan';
  qr_code?: string;
  created_at: string;
  instance_id?: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  session_id: string;
  name: string;
  description: string;
  message_template: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'audio' | 'document' | '';
  ai_enabled: boolean;
  min_delay_seconds: number;
  max_delay_seconds: number;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  status: string;
  created_at: string;
}

export interface Recipient {
  id?: string;
  phone: string; // Used for UI
  phone_number?: string; // Used for DB
  name: string;
  information: string;
}

export interface CampaignMessage {
  id: string;
  campaign_id: string;
  recipient_id: string;
  phone_number: string;
  status: string;
  updated_at: string;
  recipient?: {
    name: string;
  }
}