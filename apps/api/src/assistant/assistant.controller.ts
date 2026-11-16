import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { isLang, type AssistantAnswer, type AssistantInsights, type AssistantSuggestions } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { CustomerId, Public, Roles } from '../auth/auth.js';
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

  /** What customers and website visitors ask Eva (staff: Assistant insights). */
  @Roles('STAFF')
  @Get('insights')
  insights(): Promise<AssistantInsights> {
    return this.assistant.insights();
  }

  /** Eva for a signed-in customer. `context.route` "/website" marks a question asked on engie.nl after signing in. */
  @Roles('CUSTOMER')
  @Post('me')
  async askMe(@CustomerId() customerId: string, @Body() body: AssistantRequestDto): Promise<AssistantAnswer> {
    const context = toContext(body.context);
    const answer = await this.assistant.askMe(customerId, body.question, context, body.lang, context.route === '/website' ? 'WEBSITE_SIGNED_IN' : 'APP');
    void this.activity.record(customerId, answer.handoff ? 'ASSISTANT_HANDOFF' : 'ASSISTANT_ASKED', `“${body.question}”`);
    return answer;
  }

  @Roles('CUSTOMER')
  @Get('me/suggestions')
  mySuggestions(@CustomerId() customerId: string, @Query('lang') lang?: string, @Query('route') route?: string): Promise<AssistantSuggestions> {
    return this.assistant.mySuggestions(customerId, isLang(lang) ? lang : undefined, route);
  }

  /** Eva on the public website: no sign-in needed. */
  @Public()
  @Post('public')
  askPublic(@Body() body: AssistantRequestDto): Promise<AssistantAnswer> {
    return this.assistant.askPublic(body.question, toContext(body.context), body.lang);
  }

  @Public()
  @Get('public/suggestions')
  publicSuggestions(@Query('lang') lang?: string): AssistantSuggestions {
    return this.assistant.publicSuggestions(isLang(lang) ? lang : 'nl');
  }
}
