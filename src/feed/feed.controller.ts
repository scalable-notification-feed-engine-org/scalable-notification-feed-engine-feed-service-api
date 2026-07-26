import { Controller, Get, Param } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import * as createPost from '../interfaces/create.post';
import { FeedService } from './feed.service';
import * as updatePost from '../interfaces/update.like';
import * as updateComment from '../interfaces/update.comment';

@Controller('/api/v1/feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get(':userId')
  async getFeed(@Param('userId') userId: string) {
    return await this.feedService.getFeedForUser(userId);
  }

  @MessagePattern('post.created')
  async handlePostCreated(@Payload() data: createPost.CreatePostDto) {
    await this.feedService.processAndStorePost(data);

    return { status: 'success' };
  }

  @MessagePattern('post.liked')
  async handlePostLiked(@Payload() data: updatePost.UpdateLike) {
    await this.feedService.updateLikeCount(data);
    return { status: 'success' };
  }

  @MessagePattern('post.commented')
  async handlePostComment(@Payload() data: updateComment.UpdateComment) {
    await this.feedService.updateComment(data);
  }
}
