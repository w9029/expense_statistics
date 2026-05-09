export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createApiClient() {
  return {
    health: async () => ({
      app: 'expense-statistics-server',
      env: 'test',
      now: '2026-05-09T00:00:00.000Z',
    }),
    login: async () => {
      throw new Error('Not implemented in test');
    },
    register: async () => {
      throw new Error('Not implemented in test');
    },
    refresh: async () => {
      throw new Error('Not implemented in test');
    },
  };
}
