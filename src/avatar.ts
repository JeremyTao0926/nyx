export type ProfileGender = "male" | "female";

export const DEFAULT_AVATAR = {
  male: "/avatars/default-male.png",
  female: "/avatars/default-female.png",
} as const;

export function defaultAvatarForGender(gender?: string | null): string {
  return gender === "female" ? DEFAULT_AVATAR.female : DEFAULT_AVATAR.male;
}

export function resolveAvatar(url?: string | null, gender?: string | null): string {
  const cleanUrl = typeof url === "string" ? url.trim() : "";
  return cleanUrl || defaultAvatarForGender(gender);
}
