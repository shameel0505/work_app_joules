import supertest from 'supertest';
import { buildApp } from '../../../app';

const app = buildApp();
var s3Mock: any;

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => {
        s3Mock = { send: jest.fn().mockResolvedValue({}) };
        return s3Mock;
    }),
    PutObjectCommand: jest.fn(), DeleteObjectCommand: jest.fn(), CreateBucketCommand: jest.fn(), HeadBucketCommand: jest.fn()
  };
});

jest.mock('../../../shared/jobs/releasePayment.job', () => ({
  releasePaymentQueue: {
      add: jest.fn().mockResolvedValue(true)
  }
}));

var taskerFindUniqueMock: jest.Mock;
var taskFindUniqueMock: jest.Mock;
var bidCreateMock: jest.Mock;
var bidFindManyMock: jest.Mock;
var bidFindUniqueMock: jest.Mock;
var taskUpdateMock: jest.Mock;
var txMock: jest.Mock;

jest.mock('@prisma/client', () => {
    taskerFindUniqueMock = jest.fn();
    taskFindUniqueMock = jest.fn();
    bidCreateMock = jest.fn();
    bidFindManyMock = jest.fn();
    bidFindUniqueMock = jest.fn();
    taskUpdateMock = jest.fn();
    
    // Simulate transaction execution
    txMock = jest.fn().mockImplementation(async (callback) => {
        return callback({
            task: { update: taskUpdateMock, findUnique: taskFindUniqueMock },
            bid: { update: jest.fn(), updateMany: jest.fn() },
            payment: { create: jest.fn() },
            user: { update: jest.fn() },
            walletTransaction: { create: jest.fn() }
        });
    });

    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                $transaction: txMock,
                tasker: { findUnique: taskerFindUniqueMock },
                task: { findUnique: taskFindUniqueMock, update: taskUpdateMock },
                bid: { create: bidCreateMock, findMany: bidFindManyMock, findUnique: bidFindUniqueMock, delete: jest.fn() },
            };
        }),
        TaskStatus: { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED' },
        BidStatus: { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED' }
    }
})

describe('Bids & Progression Module', () => {
  let server: any;
  let customerToken: string;
  let taskerToken: string;

  beforeAll(async () => {
    await app.ready();
    server = app.server;
    customerToken = app.jwt.sign({ id: 'user-1', role: 'CUSTOMER' });
    taskerToken = app.jwt.sign({ id: 'user-2', role: 'TASKER' }); // Tasker user ID
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
      jest.clearAllMocks();
  });

  describe('POST /api/v1/tasks/:taskId/bids', () => {
    it('should reject duplicate bids', async () => {
      taskerFindUniqueMock.mockResolvedValue({ id: 'tasker-1', userId: 'user-2', isVerified: true, isOnline: true });
      taskFindUniqueMock.mockResolvedValue({ 
          id: 'task-1', status: 'PENDING', customerId: 'user-other',
          bids: [{ taskerId: 'tasker-1' }] 
      });

      const response = await supertest(server)
        .post('/api/v1/tasks/task-1/bids')
        .set('Authorization', `Bearer ${taskerToken}`)
        .send({ amount_fils: 5000, message: 'I can do this', eta_minutes: 30 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('DUPLICATE_BID');
    });

    it('should place bid successfully', async () => {
        taskerFindUniqueMock.mockResolvedValue({ id: 'tasker-1', userId: 'user-2', isVerified: true, isOnline: true });
        taskFindUniqueMock.mockResolvedValue({ 
            id: 'task-1', status: 'PENDING', customerId: 'user-other',
            bids: [] 
        });
        bidCreateMock.mockResolvedValue({ id: 'bid-1' });

        const response = await supertest(server)
          .post('/api/v1/tasks/task-1/bids')
          .set('Authorization', `Bearer ${taskerToken}`)
          .send({ amount_fils: 5000, message: 'I can do this', eta_minutes: 30 });
  
        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe('bid-1');
    });
  });

  describe('POST /api/v1/tasks/:taskId/bids/:bidId/accept', () => {
    it('should accept bid and create simulated payment', async () => {
        taskFindUniqueMock.mockResolvedValue({ id: 'task-1', status: 'PENDING', customerId: 'user-1' });
        bidFindUniqueMock.mockResolvedValue({ id: 'bid-1', taskId: 'task-1', taskerId: 'tasker-1', amountFils: 5000 });
        taskUpdateMock.mockResolvedValue({ id: 'task-1', status: 'ACCEPTED' });

        const response = await supertest(server)
          .post('/api/v1/tasks/task-1/bids/bid-1/accept')
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/v1/tasks/:taskId/start', () => {
    it('should block pending to in_progress transition', async () => {
        taskerFindUniqueMock.mockResolvedValue({ id: 'tasker-1', userId: 'user-2' });
        taskFindUniqueMock.mockResolvedValue({ id: 'task-1', status: 'PENDING', taskerId: 'tasker-1' });

        const response = await supertest(server)
          .patch('/api/v1/tasks/task-1/start')
          .set('Authorization', `Bearer ${taskerToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('INVALID_STATUS');
    });

    it('should start accepted task', async () => {
        taskerFindUniqueMock.mockResolvedValue({ id: 'tasker-1', userId: 'user-2' });
        taskFindUniqueMock.mockResolvedValue({ id: 'task-1', status: 'ACCEPTED', taskerId: 'tasker-1' });
        taskUpdateMock.mockResolvedValue({ id: 'task-1', status: 'IN_PROGRESS' });

        const response = await supertest(server)
          .patch('/api/v1/tasks/task-1/start')
          .set('Authorization', `Bearer ${taskerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
  });
});
