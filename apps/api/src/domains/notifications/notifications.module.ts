import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [SupabaseService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
