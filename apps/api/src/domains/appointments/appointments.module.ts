import { Module, forwardRef } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  providers: [SupabaseService, AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
