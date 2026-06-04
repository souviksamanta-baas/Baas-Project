import { Module } from '@nestjs/common';

import { AiModule } from './ai/ai.module';
import { ConversationsModule } from './conversations/conversations.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TasksModule } from './tasks/tasks.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    OrganizationsModule,
    CustomersModule,
    ConversationsModule,
    TasksModule,
    InventoryModule,
    AiModule,
    WhatsAppModule,
  ],
  exports: [
    OrganizationsModule,
    CustomersModule,
    ConversationsModule,
    TasksModule,
    InventoryModule,
    AiModule,
    WhatsAppModule,
  ],
})
export class DomainModule {}
