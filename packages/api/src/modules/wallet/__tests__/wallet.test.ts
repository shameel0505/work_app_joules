import supertest from 'supertest';
import { buildApp } from '../../../app';

const app = buildApp();

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                $transaction: jest.fn().mockImplementation(async (callback) => {
                    return callback({
                        user: { update: jest.fn().mockResolvedValue({ walletBalanceFils: 15000 }) },
                        walletTransaction: { create: jest.fn().mockResolvedValue({ id: 'tx-1' }) }
                    });
                }),
                user: { findUnique: jest.fn().mockResolvedValue({ walletBalanceFils: 10000 }) },
                walletTransaction: { findMany: jest.fn().mockResolvedValue([]) }
            };
        })
    }
});

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn()
    }));
});

jest.mock('socket.io', () => {
    return {
        Server: jest.fn().mockImplementation(() => {
            return {
                use: jest.fn(),
                on: jest.fn(),
                to: jest.fn().mockReturnValue({ emit: jest.fn() })
            }
        })
    };
});

describe('Wallet Module', () => {
  let server: any;
  let token: string;

  beforeAll(async () => {
    await app.ready();
    server = app.server;
    token = app.jwt.sign({ id: 'user-1', role: 'CUSTOMER' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should format AED balance correctly', async () => {
      const response = await supertest(server)
          .get('/api/v1/wallet/balance')
          .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.balance_fils).toBe(10000);
      expect(response.body.data.balance_aed).toBe('100.00');
  });

  it('should enforce min/max topup limits', async () => {
      const responseMin = await supertest(server)
          .post('/api/v1/wallet/topup')
          .set('Authorization', `Bearer ${token}`)
          .send({ amount_fils: 4000 }); // Min is 5000

      expect(responseMin.status).toBe(400);

      const responseMax = await supertest(server)
          .post('/api/v1/wallet/topup')
          .set('Authorization', `Bearer ${token}`)
          .send({ amount_fils: 600000 }); // Max is 500000

      expect(responseMax.status).toBe(400);
  });

  it('should process simulated topup', async () => {
      const response = await supertest(server)
          .post('/api/v1/wallet/topup')
          .set('Authorization', `Bearer ${token}`)
          .send({ amount_fils: 5000 });

      expect(response.status).toBe(200);
      expect(response.body.data.balance_fils).toBe(15000);
  });
});
