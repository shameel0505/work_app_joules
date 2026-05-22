import { initializeSocket, getIoInstance } from '../socket.gateway';
import { buildApp } from '../../../app';

const app = buildApp();
let ioInstance: any;

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK')
    }));
});

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                task: {
                    findMany: jest.fn().mockResolvedValue([{ id: 'task-1' }]),
                    findUnique: jest.fn().mockResolvedValue({ id: 'task-1', taskerId: 'tasker-1', customerId: 'user-1', locationLat: 25.0, locationLng: 55.0 })
                },
                tasker: {
                    findUnique: jest.fn().mockResolvedValue({ id: 'tasker-1', userId: 'user-2' }),
                    update: jest.fn().mockResolvedValue({})
                },
                message: {
                    create: jest.fn().mockResolvedValue({ id: 'msg-1', taskId: 'task-1', content: 'hello', sender: { firstName: 'John' } }),
                    update: jest.fn().mockResolvedValue({ id: 'msg-1', readAt: new Date() })
                }
            };
        })
    }
});

jest.mock('socket.io', () => {
    return {
        Server: jest.fn().mockImplementation(() => {
            return {
                use: jest.fn(),
                on: jest.fn(),
                to: jest.fn().mockReturnValue({ emit: jest.fn() }),
                sockets: { adapter: { rooms: new Map() } }
            }
        })
    };
});

describe('Socket Gateway', () => {
    beforeAll(async () => {
        await app.ready();
        initializeSocket(app);
        ioInstance = getIoInstance();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should initialize socket server', () => {
        expect(ioInstance).toBeDefined();
    });
});
