export interface CreatePostDto {
  id: string;
  content: string;
  userId: string;
  mediaUrl: string[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isLike: boolean;
}
