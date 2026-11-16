import { InstrumentServiceResponseDto } from '../../services/dto/instrument-service-response.dto.js';

export class InstrumentResponseDto {
  constructor(
    public readonly id: number,
    public readonly ticker: string | null,
    public readonly name: string | null,
    public readonly type: string | null,
  ) {}

  static map(instrument: InstrumentServiceResponseDto): InstrumentResponseDto {
    return new InstrumentResponseDto(
      instrument.id,
      instrument.ticker,
      instrument.name,
      instrument.type,
    );
  }
}
