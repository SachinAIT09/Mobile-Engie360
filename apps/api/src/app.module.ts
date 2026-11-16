import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from './config.js';
import { ActivityController } from './activity/activity.controller.js';
import { ActivityService } from './activity/activity.service.js';
import { AuthController } from './auth/auth.controller.js';
import { BillingController } from './billing/billing.controller.js';
import { BillingService } from './billing/billing.service.js';
import { UsageService } from './usage/usage.service.js';
import { AssistantController } from './assistant/assistant.controller.js';
import { AssistantService } from './assistant/assistant.service.js';
import { AuditController } from './audit/audit.controller.js';
import { AuditService } from './audit/audit.service.js';
import { AuthGuard, AuthTokens } from './auth/auth.js';
import { CampaignDispatcher } from './campaigns/campaign-dispatcher.js';
import { CampaignStatsService } from './campaigns/campaign-stats.service.js';
import { CampaignsController } from './campaigns/campaigns.controller.js';
import { CampaignsService } from './campaigns/campaigns.service.js';
import { SimulationScheduler } from './campaigns/simulation.scheduler.js';
import { CustomersService } from './customers/customers.service.js';
import { MeController } from './customers/me.controller.js';
import { Db } from './db/db.service.js';
import { ALL_SCHEMAS } from './db/schemas.js';
import { DemoController } from './demo/demo.controller.js';
import { FlexEventsController } from './flex-events/flex-events.controller.js';
import { FlexEventsService } from './flex-events/flex-events.service.js';
import { EnergyService } from './energy/energy.service.js';
import { SmartChargingController } from './energy/smart-charging.controller.js';
import { SmartChargingService } from './energy/smart-charging.service.js';
import { EnrollmentsController } from './enrollments/enrollments.controller.js';
import { EnrollmentsService } from './enrollments/enrollments.service.js';
import { GridController } from './grid/grid.controller.js';
import { GridService } from './grid/grid.service.js';
import { ReportsService } from './grid/reports.service.js';
import { LiveEventsService } from './live-events/live-events.service.js';
import { MessagesController } from './messages/messages.controller.js';
import { MessagesService } from './messages/messages.service.js';
import { MockIdealProvider, PaymentProvider } from './payments/payment-provider.js';
import { PaymentsController } from './payments/payments.controller.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';
import { RealtimeService } from './realtime/realtime.service.js';
import { SeedService } from './seed/seed.service.js';
import { EvDetectionSource, SimulatedNet2GridSource } from './sim/ev-detection-source.js';
import { SimController } from './sim/sim.controller.js';
import { PushController } from './push/push.controller.js';
import { WebPushService } from './push/web-push.service.js';
import { SimService } from './sim/sim.service.js';

@Module({
  imports: [MongooseModule.forRootAsync({ useFactory: () => ({ uri: config.mongoUrl }) }), MongooseModule.forFeature(ALL_SCHEMAS)],
  controllers: [
    AuthController,
    MeController,
    PaymentsController,
    BillingController,
    MessagesController,
    EnrollmentsController,
    FlexEventsController,
    GridController,
    CampaignsController,
    SimController,
    DemoController,
    AssistantController,
    SmartChargingController,
    AuditController,
    ActivityController,
    PushController,
  ],
  providers: [
    Db,
    AuthTokens,
    { provide: APP_GUARD, useClass: AuthGuard },
    RealtimeService,
    RealtimeGateway,
    SeedService,
    GridService,
    ReportsService,
    LiveEventsService,
    EnergyService,
    CampaignStatsService,
    MessagesService,
    EnrollmentsService,
    FlexEventsService,
    CampaignsService,
    SimulationScheduler,
    CampaignDispatcher,
    AuditService,
    ActivityService,
    WebPushService,
    SmartChargingService,
    AssistantService,
    BillingService,
    UsageService,
    CustomersService,
    SimService,
    { provide: EvDetectionSource, useClass: SimulatedNet2GridSource },
    { provide: PaymentProvider, useClass: MockIdealProvider },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly seed: SeedService) {}

  /** Seed automatically the first time the API starts against an empty database. */
  async onApplicationBootstrap() {
    if (await this.seed.seedIfEmpty()) new Logger('Seed').log('Empty database: demo data seeded');
  }
}
