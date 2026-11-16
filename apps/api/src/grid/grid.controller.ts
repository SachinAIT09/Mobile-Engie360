import { Controller, Get, Param } from '@nestjs/common';
import type { BlindSpot, DeadGridArea, DistrictStat, LiveEvent, ReportsSummary, StatsOverview, GridAreaStat } from '@engie/shared';
import { Roles } from '../auth/auth.js';
import { LiveEventsService } from '../live-events/live-events.service.js';
import { GridService } from './grid.service.js';
import { ReportsService } from './reports.service.js';

/** District visibility dashboard (staff). */
@Roles('STAFF')
@Controller()
export class GridController {
  constructor(
    private readonly grid: GridService,
    private readonly liveEvents: LiveEventsService,
    private readonly reports: ReportsService,
  ) {}

  @Get('stats/overview')
  overview(): Promise<StatsOverview> {
    return this.grid.overview();
  }

  @Get('stats/blind-spots')
  blindSpots(): Promise<BlindSpot[]> {
    return this.grid.blindSpots();
  }

  @Get('stats/dead-gridAreas')
  dead(): Promise<DeadGridArea[]> {
    return this.grid.deadGridAreas();
  }

  @Get('stats/reports')
  reportsSummary(): Promise<ReportsSummary> {
    return this.reports.summary();
  }

  @Get('gridAreas')
  gridAreas(): Promise<GridAreaStat[]> {
    return this.grid.gridAreas();
  }

  @Get('gridAreas/:code/districts')
  districts(@Param('code') code: string): Promise<DistrictStat[]> {
    return this.grid.gridAreaDistricts(code);
  }

  @Get('districts/:code')
  district(@Param('code') code: string): Promise<DistrictStat> {
    return this.grid.district(code);
  }

  @Get('live-events')
  live(): Promise<LiveEvent[]> {
    return this.liveEvents.latest();
  }
}
