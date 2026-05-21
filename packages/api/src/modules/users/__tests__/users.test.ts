import supertest from 'supertest';
import { buildApp } from '../../../app';

const app = buildApp();
var s3Mock: any;

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => {
        s3Mock = {
            send: jest.fn().mockResolvedValue({}),
        };
        return s3Mock;
    }),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    CreateBucketCommand: jest.fn(),
    HeadBucketCommand: jest.fn()
  };
});

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                user: {
                    findUnique: jest.fn().mockResolvedValue({ id: 'user-1', firstName: 'John', lastName: 'Doe', avatarUrl: 'http://old.jpg' }),
                    update: jest.fn().mockResolvedValue({ id: 'user-1', firstName: 'John', avatarUrl: 'http://new.jpg' }),
                },
                savedAddress: {
                    findMany: jest.fn().mockResolvedValue([{ id: 'addr-1' }]),
                    create: jest.fn().mockResolvedValue({ id: 'addr-2' }),
                    findUnique: jest.fn().mockResolvedValue({ id: 'addr-1', userId: 'user-1' }),
                    delete: jest.fn().mockResolvedValue({}),
                }
            };
        })
    }
})

describe('Users Module', () => {
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

  describe('GET /api/v1/users/me', () => {
    it('should get profile', async () => {
      const response = await supertest(server)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-1');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update profile', async () => {
      const response = await supertest(server)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Jane' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/users/me/addresses', () => {
    it('should list addresses', async () => {
      const response = await supertest(server)
        .get('/api/v1/users/me/addresses')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });
  });
});
