import { Module, forwardRef } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  controllers: [AppointmentsController],
  imports: [forwardRef(() => NotificationsModule)],
  providers: [SupabaseService, AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
