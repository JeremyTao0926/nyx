export type Tab = "explore" | "spark" | "chat" | "profile";
export type AppMode = "normal" | "simulate";
export type GMsg = { role: "system" | "user" | "assistant"; content: string | unknown[] };

export type Msg = {
  id: string;
  from: "user" | "nyx";
  text?: string;
  images?: string[];
  timestamp: Date;
};

export type ChatMsg = {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  readAt?: Date | null;
  isImage?: boolean;
  isRecalled?: boolean;
};

export type Lang = "zh" | "en";
export type PremiumPlan = "premium" | "premium_plus";

export type ImgItem = { file: File; preview: string };

export type SimulationMessage = {
  from: "me" | "target";
  text: string;
  createdAt?: string | null;
};

export type SimulationExample = {
  context: string;
  reply: string;
  recency: number;
};

export type SimulationPersona = {
  version: 2;
  style: string;
  styleDescription: string;
  languageStyle: string;
  avgLength: "very_short" | "short" | "medium" | "long";
  emojiFreq: "none" | "low" | "medium" | "high";
  punctuationStyle: string;
  cadence: string;
  humor: "low" | "medium" | "high";
  warmth: "cold" | "neutral" | "warm" | "very_warm";
  flirting: "none" | "subtle" | "moderate" | "direct";
  directness: "indirect" | "balanced" | "direct";
  initiative: "low" | "medium" | "high";
  questionFrequency: "low" | "medium" | "high";
  signature: string[];
  laughterMarkers: string[];
  responsePatterns: string[];
  boundaries: string[];
  relationshipDynamics: string;
  confidence: number;
  sourceMessageCount: number;
  sourceBatchCount: number;
  examples: SimulationExample[];
};

export type ExtractedConvo = {
  name: string | null;
  messages: { from: "me" | "her"; text: string }[];
  styleDesc: string;
  sessionId?: string;
  persona?: SimulationPersona;
  sourceCount?: number;
  sourceBatchCount?: number;
};

export type LB = { images: string[]; index: number } | null;
export type AT = { msg: Msg; isUser: boolean } | null;

export type UserProfile = {
  id: string;
  username: string;
  display_name: string;
  birthday: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  ethnicity: string[];
  hobbies: string[];
  avatar_url: string | null;
  photos: string[];
  gender: "male" | "female";
  mbti: string;
  bio: string | null;
  looking_for_gender: string;
  filter_min_age: number;
  filter_max_age: number;
  filter_max_distance: number;
  filter_country: string | null;
  filter_ethnicity: string[] | null;
  is_verified: boolean;
  onboarding_done?: boolean;
  is_premium?: boolean;
  premium_plan?: PremiumPlan | null;
  premium_expires_at?: string | null;
  is_banned?: boolean;
  ban_reason?: string | null;
  is_active?: boolean;
  is_paused?: boolean;
  deleted_at?: string | null;
  language?: Lang;
  hide_online_status?: boolean;
  last_active?: string | null;
  occupation?: string | null;
  education?: string | null;
  income?: string | null;
  height_cm?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  exercise?: string | null;
  has_pets?: string | null;
  want_children?: string | null;
  relationship_goal?: string | null;
  love_language?: string | null;
};

export type ExploreProfile = {
  id: string;
  is_premium?: boolean;
  premium_plan?: PremiumPlan | null;
  premium_expires_at?: string | null;
  name: string;
  age: number | null;
  mbti: string;
  bio: string;
  avatar: string;
  gender?: "male" | "female";
  photos: string[];
  location: string;
  country: string;
  ethnicity: string[];
  hobbies: string[];
  verified: boolean;
  distance?: number;
  latitude?: number | null;
  longitude?: number | null;
  // Extended fields
  occupation?: string | null;
  education?: string | null;
  income?: string | null;
  height_cm?: string | null;
  drinking?: string | null;
  smoking?: string | null;
  exercise?: string | null;
  has_pets?: string | null;
  want_children?: string | null;
  relationship_goal?: string | null;
  love_language?: string | null;
};

export type FavoriteProfile = ExploreProfile & {
  favoritedAt: Date;
};

export type MatchItem = {
  id: string;
  matchId: string;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string | number;
  unread: number;
  gender?: "male" | "female";
  lastActive?: string | null;
  hideOnline?: boolean;
  isPremium?: boolean;
  premiumPlan?: PremiumPlan | null;
  prefillMsg?: string;
};

export type NyxAnalysis = {
  id: string;
  msgId: string;
  msgText: string;
  isUserMsg: boolean;
  result: string;
  createdAt: Date;
};

export type WhoLikedItem = {
  id: string;
  name: string;
  age: number | null;
  avatar: string;
  mbti: string;
  direction: 'like' | 'superlike';
  timestamp: Date;
  gender?: "male" | "female";
};

export type ProfileViewerItem = {
  id: string;
  name: string;
  age: number | null;
  avatar: string;
  gender?: "male" | "female";
  mbti: string;
  viewedAt: Date;
  premiumPlan: PremiumPlan | null;
};

export type ReportCategory = 'fake' | 'harassment' | 'nudity' | 'scam' | 'other';

export type DailyLikeStatus = {
  used: number; limit: number; remaining: number; resetAt: Date;
  isPremium: boolean; plan: string;
  superlikeUsed: number; superlikeLimit: number; superlikeRemaining: number;
  cloneUsed: number; cloneLimit: number; cloneRemaining: number;
};
