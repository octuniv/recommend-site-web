import { z } from "zod";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  BOT = "bot",
}

export enum BoardPurpose {
  GENERAL = "general",
  AI_DEGEST = "ai_digest",
}

export interface User {
  name: string;
  nickname: string;
  email: string;
  password: string;
}

export interface UserState {
  errors?: {
    [key in keyof User]?: string[];
  };
  message?: string | null;
}

export const userSchema = z.object({
  name: z.string().min(1, { message: "Please enter your valid name." }),
  nickname: z.string().min(1, { message: "Please enter your nickname." }),
  email: z.string().email({ message: "This email is invalid" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

export interface UserAuthInfo {
  name: string;
  nickname: string;
  email: string;
  role: UserRole | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserAuthInfo;
}

export type LoginInfo = Omit<User, "name" | "nickname">;

export interface LoginInfoState {
  errors?: {
    [key in keyof LoginInfo]?: string[];
  };
  message?: string | null;
}

export const LoginInfoSchema = userSchema.omit({ name: true, nickname: true });

export type NicknameUpdateInfo = Pick<User, "nickname">;

export interface NicknameUpdateState {
  errors?: {
    [key in keyof NicknameUpdateInfo]?: string[];
  };
  message?: string | null;
}

export const nicknameUpdateSchema = userSchema.pick({ nickname: true });

export type PasswordUpdateInfo = Pick<User, "password"> & {
  confirmPassword: string;
};

export interface PasswordUpdateState {
  errors?: {
    [key in keyof PasswordUpdateInfo]?: string[];
  };
  message?: string | null;
}

export const PasswordUpdateSchema = z
  .object({
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "The password you entered does not match",
    path: ["confirmPassword"],
  });

export interface BoardListItemDto {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  requiredRole: UserRole;
  boardType: BoardPurpose;
}

export const BoardListItemDtoSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  requiredRole: z.nativeEnum(UserRole),
  boardType: z.nativeEnum(BoardPurpose),
});

export interface PostDto {
  id: number;
  title: string;
  content: string;
  views: number;
  commentsCount: number;
  videoUrl?: string | null;
  nickname: string;
  createdAt: string;
  updatedAt: string;
  board: BoardListItemDto;
  hotScore: number;
  channelTitle?: string | null;
  duration?: string | null;
  source?: string | null;
}

export const PostDtoSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  views: z.number(),
  commentsCount: z.number(),
  videoUrl: z.string().nullable().optional(),
  nickname: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  board: BoardListItemDtoSchema,
  hotScore: z.number(),
  channelTitle: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

// export type VideoCardInfo = Omit<PostDto, "content" | "updatedAt">;
export type VideoCardInfo = Pick<
  PostDto,
  "id" | "title" | "nickname" | "createdAt" | "videoUrl"
> & {
  channelTitle?: string | null;
  duration?: string | null;
  source?: string | null;
};

export const postSchema = z.object({
  title: z.string().min(1, { message: "Please enter your title." }),
  content: z.string().min(1, { message: "Please enter your content." }),
  videoUrl: z.string().optional(),
});

export interface PostState {
  errors?: {
    title?: string[];
    content?: string[];
  };
  message?: string | null;
}

export interface CreatePostRequestBody {
  title: string;
  content: string;
  videoUrl: string;
  boardSlug: string;
}

export interface DashboardSummaryDto {
  visitors: number;
  recentPosts: PostDto[];
  popularPosts: PostDto[];
  noticesPosts: PostDto[];
}

export const DashboardSummaryDtoSchema = z.object({
  visitors: z.number(),
  recentPosts: z.array(PostDtoSchema),
  popularPosts: z.array(PostDtoSchema),
  noticesPosts: z.array(PostDtoSchema),
});
