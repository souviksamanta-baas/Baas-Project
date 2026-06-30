import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SupabaseService } from '../../supabase/supabase.service';
import { OrganizationInvitesService } from './organization-invites.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController],
  providers: [SupabaseService, OrganizationsService, OrganizationInvitesService],
  exports: [OrganizationsService, OrganizationInvitesService],
})
export class OrganizationsModule {}
