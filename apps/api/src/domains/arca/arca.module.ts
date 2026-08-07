import { Module } from '@nestjs/common';

import { SupabaseService } from '../../supabase/supabase.service';
import { ArcaAuthService } from './arca-auth.service';
import { ArcaConnectionService } from './arca-connection.service';
import { ArcaController } from './arca.controller';
import { ArcaPdfService } from './arca-pdf.service';
import { ArcaQrService } from './arca-qr.service';
import { ArcaSoapClient } from './arca-soap.client';
import { ArcaWsfeService } from './arca-wsfe.service';

@Module({
  controllers: [ArcaController],
  providers: [
    SupabaseService,
    ArcaSoapClient,
    ArcaAuthService,
    ArcaConnectionService,
    ArcaWsfeService,
    ArcaQrService,
    ArcaPdfService,
  ],
  exports: [
    ArcaAuthService,
    ArcaConnectionService,
    ArcaWsfeService,
    ArcaQrService,
    ArcaPdfService,
    ArcaSoapClient,
  ],
})
export class ArcaModule {}
