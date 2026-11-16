import { Body, Controller, Get, Post } from '@nestjs/common';
import type { AssistantAnswer, AssistantSuggestions } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { CustomerId, Roles } from '../auth/auth.js';
import { AssistantRequestDto, toContext } from './assistant.dto.js';
import { AssistantService } from './assistant.service.js';

@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly activity: ActivityService,
  ) {}

  @Roles('STAFF')
  @Post('staff')
  askStaff(@Body() body: AssistantRequestDto): Promise<AssistantAnswer> {
    return this.assistant.askStaff(body.question, toContext(body.context));
  }

  @Roles('STAFF')
  @Get('staff/suggestions')
  staffSuggestions(): Promise<AssistantSuggestions> {
    return this.assistant.staffSuggestions();
  }

  @Roles('CUSTOMER')
  @Post('me')
  async askMe(@CustomerId() customerId: string, @Body() body: AssistantRequestDto): Promise<AssistantAnswer> {
    const answer = await this.assistant.askMe(customerId, body.question, toContext(body.context));
    void this.activity.record(customerId, 'ASSISTANT_ASKED', `“${body.question}”`);
    return answer;
  }

  @Roles('CUSTOMER')
  @Get('me/suggestions')
  mySuggestions(@CustomerId() customerId: string): Promise<AssistantSuggestions> {
    return this.assistant.mySuggestions(customerId);
  }
}
