export interface UpdateComment {
  postId: string;
  commentCount: number;
  userName: string;
  comments: CommentContent[];
}

export interface CommentContent {
  id?: string;
  userId: string;
  content: string;
  createdAt?: string | Date;
}
