import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { AuthController } from './auth.controller';
import { AuthSessionService } from './auth-session.service';
import { PlatformWhatsAppAuthService } from './platform-whatsapp-auth.service';

@Module({
  controllers: [AuthController],
  providers: [SupabaseService, AuthSessionService, PlatformWhatsAppAuthService],
  exports: [AuthSessionService, PlatformWhatsAppAuthService],
})
export class AuthModule {}
