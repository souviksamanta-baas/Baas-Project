import { Module } from '@nestjs/common';

import { RegisteredOwnerClaimService } from '../admin/registered-owner-claim.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthController } from './auth.controller';
import { AuthSessionService } from './auth-session.service';
import { IdentityController } from './identity.controller';
import { IdentityLinkService } from './identity-link.service';
import { PlatformEmailAuthService } from './platform-email-auth.service';
import { PlatformWhatsAppAuthService } from './platform-whatsapp-auth.service';

@Module({
  controllers: [AuthController, IdentityController],
  providers: [
    SupabaseService,
    RegisteredOwnerClaimService,
    AuthSessionService,
    PlatformEmailAuthService,
    PlatformWhatsAppAuthService,
    IdentityLinkService,
  ],
  exports: [
    AuthSessionService,
    PlatformEmailAuthService,
    PlatformWhatsAppAuthService,
    IdentityLinkService,
  ],
})
export class AuthModule {}
