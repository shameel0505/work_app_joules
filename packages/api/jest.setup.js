jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue(true),
    on: jest.fn()
  })),
  Worker: jest.fn()
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      incr: jest.fn().mockResolvedValue(4), // mock rate limit exceeded by default
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue('123456'),
      del: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      disconnect: jest.fn()
    };
  });
});
