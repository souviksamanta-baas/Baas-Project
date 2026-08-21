import { Module, forwardRef } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [InventoryModule, forwardRef(() => NotificationsModule)],
  controllers: [TasksController],
  providers: [SupabaseService, TasksService],
  exports: [TasksService],
})
export class TasksModule {}
