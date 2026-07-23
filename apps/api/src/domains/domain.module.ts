import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { ConversationsModule } from './conversations/conversations.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TasksModule } from './tasks/tasks.module';
import { InstagramModule } from './instagram/instagram.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    ConversationsModule,
    TasksModule,
    InventoryModule,
    AiModule,
    WhatsAppModule,
    InstagramModule,
  ],
  exports: [
    AuthModule,
    OrganizationsModule,
    CustomersModule,
    ConversationsModule,
    TasksModule,
    InventoryModule,
    AiModule,
    WhatsAppModule,
    InstagramModule,
  ],
})
export class DomainModule {}
