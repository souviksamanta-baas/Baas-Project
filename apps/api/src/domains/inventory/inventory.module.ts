import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { InventoryService } from './inventory.service';

@Module({
  providers: [SupabaseService, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
