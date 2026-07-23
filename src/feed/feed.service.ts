import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { CreatePostDto } from '../interfaces/create.post';
import { UpdateLike } from '../interfaces/update.like';

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
    console.log('Getting feed for user', userId);
    const redis = this.redisService.getClient();
    const globalKey = `global:feed`;
    const userLikesKey = `user:${userId}:likes`;

    const posts = await redis.zrevrange(globalKey, 0, 19);

    const likedPostIds = await redis.smembers(userLikesKey);
    const likedSet = new Set(likedPostIds);

    const parsePosts = posts
      .map((post) => {
        try {
          if (typeof post === 'string') {
            const parsed = JSON.parse(post) as Record<string, any>;

            return {
              ...parsed,
              isLike: likedSet.has(parsed.id),
            };
          }
          return null;
        } catch {
          console.error('Failed to parse post:', post);
          return null;
        }
      })
      .filter((post) => post !== null);

    return parsePosts;
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
      console.log(
        `Redis Global Feed LikeCount Updated for Post: ${data.postId}`,
      );
    } else {
      console.warn(`Post ${data.postId} not found in Redis global feed.`);
    }
  }
}
