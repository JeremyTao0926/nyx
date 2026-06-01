export type Tab = "explore" | "spark" | "chat" | "profile";
export type AppMode = "normal" | "simulate";
export type GMsg = { role: "system" | "user" | "assistant"; content: string | any[] };

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
};

export type Lang = "zh" | "en";

export type ImgItem = { file: File; preview: string };

export type ExtractedConvo = {
  name: string | null;
  messages: { from: "me" | "her"; text: string }[];
  styleDesc: string;
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
};

export type ExploreProfile = {
  id: string;
  name: string;
  age: number | null;
  mbti: string;
  bio: string;
  avatar: string;
  photos: string[];
  location: string;
  country: string;
  ethnicity: string[];
  hobbies: string[];
  verified: boolean;
  distance?: number;
};

export type MatchItem = {
  id: string;
  matchId: string;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread: number;
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
};

export type ReportCategory = 'fake' | 'harassment' | 'nudity' | 'scam' | 'other';

export type DailyLikeStatus = {
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  isPremium: boolean;
};
