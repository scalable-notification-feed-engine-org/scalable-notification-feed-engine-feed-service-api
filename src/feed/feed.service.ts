import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { CreatePostDto } from '../interfaces/create.post';
import { UpdateLike } from '../interfaces/update.like';
import { UpdateComment } from '../interfaces/update.comment';

@Injectable()
export class FeedService {
  constructor(private readonly redisService: RedisService) {}

  async processAndStorePost(postData: CreatePostDto) {
    const redis = this.redisService.getClient();

    const globalKey = `global:feed`;
    const score = Date.now();
    const member = JSON.stringify(postData);

    await redis.zadd(globalKey, score, member);
    await redis.zremrangebyrank(globalKey, 0, -101);
  }

  async getFeedForUser(userId: string): Promise<any[]> {
    const redis = this.redisService.getClient();
    const globalKey = `global:feed`;
    const userLikesKey = `user:${userId}:likes`;

    const posts = await redis.zrevrange(globalKey, 0, 19);

    const likedPostIds = await redis.smembers(userLikesKey);
    const likedSet = new Set(likedPostIds);

    return posts
      .map((post) => {
        try {
          if (typeof post === 'string') {
            const parsed = JSON.parse(post) as Record<string, any>;
            return {
              ...parsed,
              isLike: likedSet.has(parsed.id),
              comments: parsed.comments || [],
              userName: parsed.userName,
            };
          }
          return null;
        } catch {
          console.error('Failed to parse post:', post);
          return null;
        }
      })
      .filter((post) => post !== null);
  }

  async updateLikeCount(data: UpdateLike) {
    const redis = this.redisService.getClient();
    const globalKey = `global:feed`;
    const userLikesKey = `user:${data.userId}:likes`;

    if (data.isLike) {
      await redis.sadd(userLikesKey, data.postId);
    } else {
      await redis.srem(userLikesKey, data.postId);
    }
    const allPost = await redis.zrange(globalKey, 0, -1);

    const targetPostString = allPost.find((p) => {
      try {
        const parsed = JSON.parse(p) as CreatePostDto;
        return (
          typeof parsed === 'object' &&
          parsed !== null &&
          parsed.id === data.postId
        );
      } catch {
        return false;
      }
    });

    if (targetPostString) {
      const postObj = JSON.parse(targetPostString) as Record<string, any>;

      postObj.likeCount = data.likeCount;
      const dateSource = (postObj.createdAt || postObj.createAt) as string;
      let score = new Date(dateSource).getTime();

      if (isNaN(score)) {
        score = Date.now();
      }

      const updatedPostString = JSON.stringify(postObj);
      await redis.zrem(globalKey, targetPostString);
      await redis.zadd(globalKey, score, updatedPostString);
    } else {
      console.warn(`Post ${data.postId} not found in Redis global feed.`);
    }
  }

  async updateComment(data: UpdateComment): Promise<void> {
    const redis = this.redisService.getClient();
    const globalKey = `global:feed`;

    const allPost: string[] = await redis.zrange(globalKey, 0, -1);

    let targetPostString: string | null = null;
    let parsedPost: Record<string, unknown> | null = null;

    for (const p of allPost) {
      const parsed: Record<string, unknown> | null = (() => {
        try {
          const item = JSON.parse(p) as unknown;
          return item && typeof item === 'object'
            ? (item as Record<string, unknown>)
            : null;
        } catch {
          return null;
        }
      })();

      if (parsed && parsed.id === data.postId) {
        targetPostString = p;
        parsedPost = parsed;
        break;
      }
    }

    if (targetPostString && parsedPost) {
      const existingComments = Array.isArray(parsedPost.comments)
        ? (parsedPost.comments as Record<string, unknown>[])
        : [];

      const userName = data.userName || 'Unknown User';
      const rawIncoming = Array.isArray(data.comments)
        ? data.comments
        : (data as any).comment
          ? [(data as any).comment]
          : [
              {
                id: (data as any).commentId || Date.now().toString(),
                content: (data as any).content || '',
                userId: (data as any).userId || '',
                createdAt: new Date().toISOString(),
              },
            ];

      const incomingComments: Record<string, unknown>[] = rawIncoming.map(
        (cmt: any) => ({
          ...cmt,
          userName: cmt.userName || userName,
        }),
      );

      parsedPost.comments = [...existingComments, ...incomingComments];
      parsedPost.commentCount = (parsedPost.comments as any[]).length;

      const score: string | null = await redis.zscore(
        globalKey,
        targetPostString,
      );
      let numericScore: number = score !== null ? Number(score) : Date.now();

      if (isNaN(numericScore)) {
        numericScore = Date.now();
      }

      const updatedPostString = JSON.stringify(parsedPost);

      await redis.zrem(globalKey, targetPostString);
      await redis.zadd(globalKey, numericScore, updatedPostString);
    } else {
      console.warn(`Post ${data.postId} not found in Redis global feed.`);
    }
  }
}
