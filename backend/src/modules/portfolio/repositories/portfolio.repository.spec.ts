import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import { PortfolioRepository } from './portfolio.repository.js';

describe('PortfolioRepository', () => {
  let repository: PortfolioRepository;
  const prisma = {
    user: { findUnique: jest.fn<PrismaService['user']['findUnique']>() },
    order: { findMany: jest.fn<PrismaService['order']['findMany']>() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PortfolioRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    repository = module.get(PortfolioRepository);
  });

  it('loads filled and NEW orders with the latest related market data', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: null,
      accountNumber: null,
    });
    const orderRecords = [
      {
        id: 1,
        instrumentId: 47,
        userId: 1,
        size: 2,
        price: new Prisma.Decimal(100),
        type: 'MARKET',
        side: 'BUY',
        status: 'FILLED',
        datetime: new Date('2026-01-01'),
        instrument: {
          id: 47,
          ticker: 'BBAR',
          name: 'Banco Frances',
          type: 'ACCIONES',
          marketdata: [
            {
              id: 2,
              instrumentId: 47,
              high: null,
              low: null,
              open: null,
              close: new Prisma.Decimal(110),
              previousClose: new Prisma.Decimal(100),
              date: new Date('2026-01-02'),
            },
          ],
        },
      },
    ];
    prisma.order.findMany.mockResolvedValue(orderRecords);

    await expect(repository.findByUserId(1)).resolves.toMatchObject({
      userId: 1,
      userExists: true,
      orders: [
        {
          id: 1,
          price: '100.00',
          datetime: new Date('2026-01-01'),
          instrument: {
            ticker: 'BBAR',
            close: '110.00',
            previousClose: '100.00',
          },
        },
      ],
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, status: { in: ['FILLED', 'NEW'] } },
        orderBy: [{ datetime: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      }),
    );
  });
});
