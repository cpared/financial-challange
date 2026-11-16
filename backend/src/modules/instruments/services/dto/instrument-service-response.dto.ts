import { InstrumentRepositoryResponseDto } from '../../repositories/dto/instrument-repository-response.dto.js';

export class InstrumentServiceResponseDto {
  constructor(
    public readonly id: number,
    public readonly ticker: string | null,
    public readonly name: string | null,
    public readonly type: string | null,
  ) {}

  static map(
    instrument: InstrumentRepositoryResponseDto,
  ): InstrumentServiceResponseDto {
    return new InstrumentServiceResponseDto(
      instrument.id,
      instrument.ticker,
      instrument.name,
      instrument.type,
    );
  }
}
