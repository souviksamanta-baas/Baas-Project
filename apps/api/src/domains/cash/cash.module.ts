import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  controllers: [CashController],
  providers: [SupabaseService, CashService],
  exports: [CashService],
})
export class CashModule {}
