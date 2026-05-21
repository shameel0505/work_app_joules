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
                tasker: {
                    findUnique: jest.fn().mockResolvedValue({ id: 'tasker-1', userId: 'user-2', bio: 'Expert plumber' }),
                    update: jest.fn().mockResolvedValue({ id: 'tasker-1', isOnline: true }),
                }
            };
        })
    }
})

describe('Taskers Module', () => {
  let server: any;
  let token: string;

  beforeAll(async () => {
    await app.ready();
    server = app.server;
    token = app.jwt.sign({ id: 'user-2', role: 'TASKER' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/taskers/me', () => {
    it('should get tasker profile', async () => {
      const response = await supertest(server)
        .get('/api/v1/taskers/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('tasker-1');
    });
  });

  describe('PATCH /api/v1/taskers/me/location', () => {
    it('should update location quickly', async () => {
      const response = await supertest(server)
        .patch('/api/v1/taskers/me/location')
        .set('Authorization', `Bearer ${token}`)
        .send({ lat: 25.2048, lng: 55.2708 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lat).toBe(25.2048);
    });
  });

  describe('GET /api/v1/taskers/:id/public', () => {
    it('should get public profile without PII', async () => {
      const response = await supertest(server)
        .get('/api/v1/taskers/tasker-1/public');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('tasker-1');
    });
  });
});
