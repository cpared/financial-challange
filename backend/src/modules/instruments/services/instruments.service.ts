import { Injectable } from '@nestjs/common';
import { InstrumentsRepository } from '../repositories/instruments.repository.js';
import { InstrumentServiceResponseDto } from './dto/instrument-service-response.dto.js';
import { TelemetryService } from '../../../common/observability/telemetry.service.js';

@Injectable()
export class InstrumentsService {
  constructor(
    private readonly instrumentsRepository: InstrumentsRepository,
    private readonly telemetry: TelemetryService,
  ) {}

  async search(query: string): Promise<InstrumentServiceResponseDto[]> {
    return this.telemetry.runInSpan(
      'instruments.search',
      { 'app.layer': 'service' },
      async () => {
        const instruments = await this.instrumentsRepository.search(query);
        return instruments.map((instrument) =>
          InstrumentServiceResponseDto.map(instrument),
        );
      },
    );
  }
}
