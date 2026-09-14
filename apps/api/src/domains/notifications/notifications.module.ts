import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [SupabaseService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
