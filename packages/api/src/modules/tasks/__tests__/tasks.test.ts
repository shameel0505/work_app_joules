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

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue(true)
  })),
  Worker: jest.fn()
}));

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
      return {
          on: jest.fn(),
          disconnect: jest.fn()
      }
    });
});

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                task: {
                    create: jest.fn().mockResolvedValue({ id: 'task-1', locationLat: 25.0, locationLng: 55.0, categoryId: 'cat-1' }),
                    findUnique: jest.fn().mockResolvedValue({ id: 'task-1', status: 'ACCEPTED', customerId: 'user-1', taskerId: 'tasker-1', updatedAt: new Date(Date.now() - 15 * 60 * 1000) }),
                    update: jest.fn().mockResolvedValue({ id: 'task-1', status: 'CANCELLED' }),
                    findMany: jest.fn().mockResolvedValue([
                        { id: 'task-1', locationLat: 25.001, locationLng: 55.001, status: 'PENDING' },
                        { id: 'task-2', locationLat: 26.0, locationLng: 56.0, status: 'PENDING' } // far away
                    ]),
                    count: jest.fn().mockResolvedValue(1)
                },
                tasker: {
                    findUnique: jest.fn().mockResolvedValue({ userId: 'tasker-1', bids: [] })
                },
                walletTransaction: {
                    create: jest.fn().mockResolvedValue({ id: 'tx-1' })
                }
            };
        }),
        TaskStatus: {
            PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', CANCELLED: 'CANCELLED'
        }
    }
})

describe('Tasks Module', () => {
  let server: any;
  let customerToken: string;
  let taskerToken: string;

  beforeAll(async () => {
    await app.ready();
    server = app.server;
    customerToken = app.jwt.sign({ id: 'user-1', role: 'CUSTOMER' });
    taskerToken = app.jwt.sign({ id: 'tasker-1', role: 'TASKER' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/tasks', () => {
    it('should reject more than 5 photos', async () => {
      const response = await supertest(server)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${customerToken}`)
        .field('category_id', '123e4567-e89b-12d3-a456-426614174000')
        .field('title', 'Test')
        .field('description', 'Test desc')
        .field('location_lat', '25.0')
        .field('location_lng', '55.0')
        .field('location_address', 'Dubai')
        .field('budget_fils', '10000').field('scheduled_at', 'asap')
        .attach('photo1', Buffer.from('img'), { filename: '1.jpg', contentType: 'image/jpeg' })
        .attach('photo2', Buffer.from('img'), { filename: '2.jpg', contentType: 'image/jpeg' })
        .attach('photo3', Buffer.from('img'), { filename: '3.jpg', contentType: 'image/jpeg' })
        .attach('photo4', Buffer.from('img'), { filename: '4.jpg', contentType: 'image/jpeg' })
        .attach('photo5', Buffer.from('img'), { filename: '5.jpg', contentType: 'image/jpeg' })
        .attach('photo6', Buffer.from('img'), { filename: '6.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('MAX_PHOTOS_EXCEEDED');
    });

    it('should create task with valid payload', async () => {
      const response = await supertest(server)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
            category_id: '123e4567-e89b-12d3-a456-426614174000',
            title: 'Fix sink',
            description: 'Leaking sink in kitchen',
            location_lat: 25.2,
            location_lng: 55.2,
            location_address: 'Downtown Dubai',
            scheduled_at: 'asap',
            budget_fils: 5000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('task-1');
    });
  });

  describe('PATCH /api/v1/tasks/:id/cancel', () => {
    it('should cancel and apply fee if accepted >10 mins ago', async () => {
      const response = await supertest(server)
        .patch('/api/v1/tasks/task-1/cancel')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/tasks/available', () => {
    it('should filter available tasks by distance', async () => {
      const response = await supertest(server)
        .get('/api/v1/tasks/available?lat=25.0&lng=55.0&radius_km=10')
        .set('Authorization', `Bearer ${taskerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // task-1 is close, task-2 is far
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe('task-1');
    });
  });
});
