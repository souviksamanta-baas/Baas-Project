import { Module } from '@nestjs/common';

import { RegisteredOwnerClaimService } from '../admin/registered-owner-claim.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthController } from './auth.controller';
import { AuthSessionService } from './auth-session.service';
import { PlatformEmailAuthService } from './platform-email-auth.service';
import { PlatformWhatsAppAuthService } from './platform-whatsapp-auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    SupabaseService,
    RegisteredOwnerClaimService,
    AuthSessionService,
    PlatformEmailAuthService,
    PlatformWhatsAppAuthService,
  ],
  exports: [AuthSessionService, PlatformEmailAuthService, PlatformWhatsAppAuthService],
})
export class AuthModule {}
