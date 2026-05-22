import supertest from 'supertest';
import { buildApp } from '../../../app';

const app = buildApp();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      incr: jest.fn().mockImplementation((key) => {
        if (key.includes('rate_limit')) {
            return 4; // Always exceed rate limit for simplicity in the mock if it calls incr
        }
        return 1;
      }),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue('123456'),
      del: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      disconnect: jest.fn()
    };
  });
});

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                user: {
                    findUnique: jest.fn().mockResolvedValue({ id: 'user-1', phone: '+971501234567', role: 'CUSTOMER', password: 'hashedpassword' }),
                    create: jest.fn().mockResolvedValue({ id: 'user-new', phone: '+971501234568', role: 'CUSTOMER' }),
                },
                tasker: {
                    create: jest.fn().mockResolvedValue({ id: 'tasker-new' }),
                },
                refreshToken: {
                    create: jest.fn().mockResolvedValue({ id: 'token-1' }),
                    findUnique: jest.fn().mockResolvedValue({ id: 'token-1', userId: 'user-1', expiresAt: new Date(Date.now() + 100000000) }),
                    delete: jest.fn().mockResolvedValue(1),
                    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                }
            };
        })
    }
})

describe('Auth Module', () => {
  let server: any;

  beforeAll(async () => {
    process.env.OTP_DEV_MODE = 'true';
    await app.ready();
    server = app.server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/send-otp', () => {
    it('should validate phone format', async () => {
        const response = await supertest(server)
          .post('/api/v1/auth/send-otp')
          .send({ phone: '12345' });
  
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should rate limit on 4th attempt', async () => {
        const response = await supertest(server)
          .post('/api/v1/auth/send-otp')
          .send({ phone: '+971501234567' });
  
        expect(response.status).toBe(429);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    it('should verify OTP and return tokens', async () => {
        const response = await supertest(server)
          .post('/api/v1/auth/verify-otp')
          .send({ phone: '+971501234567', otp: '123456', user_type: 'customer' });
  
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('access_token');
        expect(response.body.data).toHaveProperty('refresh_token');
        expect(response.body.data).toHaveProperty('user');
    });

    it('should return 401 for wrong OTP', async () => {
        const response = await supertest(server)
          .post('/api/v1/auth/verify-otp')
          .send({ phone: '+971501234567', otp: '111111', user_type: 'customer' });
  
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_OTP');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token', async () => {
        const response = await supertest(server)
          .post('/api/v1/auth/refresh')
          .send({ refresh_token: 'valid-refresh-token' });
  
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('access_token');
        expect(response.body.data).toHaveProperty('refresh_token');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout and invalidate token', async () => {
        // Need a valid access token to access the protected logout route
        const payload = { id: 'user-1', role: 'CUSTOMER' };
        const token = app.jwt.sign(payload);

        const response = await supertest(server)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .send({ refresh_token: 'valid-refresh-token' });
  
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should return 401 if missing auth header', async () => {
        const response = await supertest(server)
          .post('/api/v1/auth/logout')
          .send({ refresh_token: 'valid-refresh-token' });
  
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
