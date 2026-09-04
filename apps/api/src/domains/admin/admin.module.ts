import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { AdminController, PublicLeadsController } from './admin.controller';
import { AdminGrokService } from './admin-grok.service';
import { AdminLeadsService } from './admin-leads.service';
import { AdminPasswordResetService } from './admin-password-reset.service';
import {
  AdminDashboardService,
  AdminOrgsService,
  AdminPaymentsService,
  AdminPlansService,
} from './admin-orgs.service';
import { RegisteredOwnerClaimService } from './registered-owner-claim.service';

@Module({
  controllers: [AdminController, PublicLeadsController],
  providers: [
    SupabaseService,
    AdminLeadsService,
    AdminOrgsService,
    AdminPlansService,
    AdminPaymentsService,
    AdminDashboardService,
    AdminGrokService,
    AdminPasswordResetService,
    RegisteredOwnerClaimService,
  ],
  exports: [AdminLeadsService, RegisteredOwnerClaimService],
})
export class AdminModule {}
