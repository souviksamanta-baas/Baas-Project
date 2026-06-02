import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { OrganizationsService } from './organizations.service';

@Module({
  providers: [SupabaseService, OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
