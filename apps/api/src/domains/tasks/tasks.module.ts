import { Module, forwardRef } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { AppointmentsModule } from '../appointments/appointments.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    InventoryModule,
    AppointmentsModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [TasksController],
  providers: [SupabaseService, TasksService],
  exports: [TasksService],
})
export class TasksModule {}
