import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BusinessCentersService } from './business-centers.service';
import { OrganizationInvitesService } from './organization-invites.service';
import { OrganizationLifecycleService } from './organization-lifecycle.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OrganizationsController],
  providers: [
    SupabaseService,
    OrganizationsService,
    OrganizationInvitesService,
    OrganizationLifecycleService,
    BusinessCentersService,
  ],
  exports: [
    OrganizationsService,
    OrganizationInvitesService,
    OrganizationLifecycleService,
    BusinessCentersService,
  ],
})
export class OrganizationsModule {}
