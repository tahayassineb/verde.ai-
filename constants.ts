export const SUPABASE_URL = "https://nlfixnhoufntbbcccnwr.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZml4bmhvdWZudGJiY2NjbndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDExNTIsImV4cCI6MjA4NDY3NzE1Mn0.KmFzxIEcRgA5-pXdJE_yZTKMFnYvapvvwQ1bFuVOKIc";
export const N8N_BASE_URL = "https://n8n.srv1041616.hstgr.cloud/webhook";

// Strict Morocco format with 212 (no plus)
export const MOROCCO_PHONE_REGEX = /^212(6|7)\d{8}$/;

export const N8N_WEBHOOKS = {
  signup: `${N8N_BASE_URL}/auth/signup`,
  sendOTP: `${N8N_BASE_URL}/auth/send-otp`,
  verifyOTP: `${N8N_BASE_URL}/auth/verify-otp`,
  createSession: `${N8N_BASE_URL}/sessions/create`,
  launchCampaign: `${N8N_BASE_URL}/campaign/launch`,
  regenerateQR: `${N8N_BASE_URL}/regenerate-qr-code`
};

export const SESSION_TABLE = 'whatsapp_sessions';
export const CAMPAIGN_TABLE = 'campaigns';
export const PHONE_NUMBER_COLUMN = 'phone_number';

export enum CampaignStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  RUNNING = 'running',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  FAILED = 'failed'
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}