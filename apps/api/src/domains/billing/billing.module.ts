import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { ArcaModule } from '../arca/arca.module';
import { BillingController } from './billing.controller';
import { InvoiceService } from './invoice.service';

@Module({
  imports: [ArcaModule],
  controllers: [BillingController],
  providers: [SupabaseService, InvoiceService],
  exports: [InvoiceService],
})
export class BillingModule {}
