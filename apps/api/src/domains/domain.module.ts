import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ArcaModule } from './arca/arca.module';
import { BillingModule } from './billing/billing.module';
import { ConversationsModule } from './conversations/conversations.module';
import { CustomersModule } from './customers/customers.module';
import { FacebookModule } from './facebook/facebook.module';
import { InventoryModule } from './inventory/inventory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TasksModule } from './tasks/tasks.module';
import { InstagramModule } from './instagram/instagram.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    ConversationsModule,
    TasksModule,
    NotificationsModule,
    InventoryModule,
    AiModule,
    WhatsAppModule,
    InstagramModule,
    FacebookModule,
    ArcaModule,
    BillingModule,
    AppointmentsModule,
  ],
  exports: [
    AdminModule,
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    ConversationsModule,
    TasksModule,
    NotificationsModule,
    InventoryModule,
    AiModule,
    WhatsAppModule,
    InstagramModule,
    FacebookModule,
    ArcaModule,
    BillingModule,
    AppointmentsModule,
  ],
})
export class DomainModule {}
