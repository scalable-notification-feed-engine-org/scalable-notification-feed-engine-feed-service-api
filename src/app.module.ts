import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { FeedModule } from './feed/feed.module';

@Module({
  imports: [RedisModule, FeedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
