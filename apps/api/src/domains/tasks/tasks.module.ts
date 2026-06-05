import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { InventoryModule } from '../inventory/inventory.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [InventoryModule],
  controllers: [TasksController],
  providers: [SupabaseService, TasksService],
  exports: [TasksService],
})
export class TasksModule {}
