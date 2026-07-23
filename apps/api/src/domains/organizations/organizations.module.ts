import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { AuthModule } from '../auth/auth.module';
import { OrganizationInvitesService } from './organization-invites.service';
import { OrganizationLifecycleService } from './organization-lifecycle.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController],
  providers: [
    SupabaseService,
    OrganizationsService,
    OrganizationInvitesService,
    OrganizationLifecycleService,
  ],
  exports: [OrganizationsService, OrganizationInvitesService, OrganizationLifecycleService],
})
export class OrganizationsModule {}
