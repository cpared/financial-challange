import { Injectable } from '@nestjs/common';
import { InstrumentsRepository } from '../repositories/instruments.repository.js';
import { InstrumentServiceResponseDto } from './dto/instrument-service-response.dto.js';

@Injectable()
export class InstrumentsService {
  constructor(private readonly instrumentsRepository: InstrumentsRepository) {}

  async search(query: string): Promise<InstrumentServiceResponseDto[]> {
    const instruments = await this.instrumentsRepository.search(query);
    return instruments.map((instrument) =>
      InstrumentServiceResponseDto.map(instrument),
    );
  }
}
