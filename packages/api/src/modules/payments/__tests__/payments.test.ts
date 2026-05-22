import supertest from 'supertest';
import { buildApp } from '../../../app';

const app = buildApp();

var txMock: jest.Mock;
var taskFindUniqueMock: jest.Mock;
var promoValidateMock: jest.Mock;
var userFindUniqueMock: jest.Mock;

jest.mock('../../promo-codes/promo-codes.service', () => {
    promoValidateMock = jest.fn();
    return {
        PromoCodesService: {
            validateCode: promoValidateMock
        }
    };
});

jest.mock('../payment-gateway.service', () => {
    return {
        PaymentGatewayService: {
            createPaymentIntent: jest.fn().mockResolvedValue({ gateway_ref: 'SIM_123', status: 'pending' }),
            capturePayment: jest.fn().mockResolvedValue({ status: 'completed' })
        }
    };
});

jest.mock('@prisma/client', () => {
    taskFindUniqueMock = jest.fn();
    userFindUniqueMock = jest.fn();
    
    txMock = jest.fn().mockImplementation(async (callback) => {
        return callback({
            user: { findUnique: userFindUniqueMock, update: jest.fn() },
            task: { update: jest.fn() },
            payment: { create: jest.fn().mockResolvedValue({ id: 'payment-1' }) },
            walletTransaction: { create: jest.fn() },
            promoCode: { update: jest.fn() }
        });
    });

    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                $transaction: txMock,
                task: { findUnique: taskFindUniqueMock },
                promoCode: { update: jest.fn() },
                payment: { findFirst: jest.fn().mockResolvedValue({ id: 'payment-1' }) }
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

describe('Payments Module', () => {
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

  describe('POST /api/v1/payments/initiate', () => {
    it('should reject payment if task not ACCEPTED', async () => {
        taskFindUniqueMock.mockResolvedValue({ id: 'task-1', status: 'PENDING' });
        const response = await supertest(server)
            .post('/api/v1/payments/initiate')
            .set('Authorization', `Bearer ${token}`)
            .send({ task_id: '123e4567-e89b-12d3-a456-426614174000', payment_method: 'card' });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_TASK_STATUS');
    });

    it('should reject wallet payment if insufficient funds', async () => {
        taskFindUniqueMock.mockResolvedValue({ id: 'task-1', status: 'ACCEPTED', priceFinal: 5000 }); // Total will be 5525
        userFindUniqueMock.mockResolvedValue({ id: 'user-1', walletBalanceFils: 1000 }); // Not enough

        const response = await supertest(server)
            .post('/api/v1/payments/initiate')
            .set('Authorization', `Bearer ${token}`)
            .send({ task_id: '123e4567-e89b-12d3-a456-426614174000', payment_method: 'wallet' });

        expect(response.status).toBe(402);
        expect(response.body.error.code).toBe('PAYMENT_REQUIRED');
    });

    it('should process wallet payment with promo code and VAT', async () => {
        // Price 5000. Promo reduces by 1000 = 4000.
        // Platform fee 500. VAT 25. Total = 4525.
        taskFindUniqueMock.mockResolvedValue({ id: 'task-1', status: 'ACCEPTED', priceFinal: 5000 });
        userFindUniqueMock.mockResolvedValue({ id: 'user-1', walletBalanceFils: 10000 });
        promoValidateMock.mockResolvedValue({ valid: true, final_amount_fils: 4000 });

        const response = await supertest(server)
            .post('/api/v1/payments/initiate')
            .set('Authorization', `Bearer ${token}`)
            .send({ task_id: '123e4567-e89b-12d3-a456-426614174000', payment_method: 'wallet', promo_code: 'SAVE10' });

        expect(response.status).toBe(200);
        expect(response.body.data.method).toBe('wallet');
        expect(response.body.data.payment_id).toBe('payment-1');
    });
  });
});
