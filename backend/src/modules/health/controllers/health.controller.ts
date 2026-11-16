import { Controller, Get } from '@nestjs/common';

@Controller('ping')
export class HealthController {
  @Get()
  ping(): { readonly status: 'ok' } {
    return { status: 'ok' };
  }
}
