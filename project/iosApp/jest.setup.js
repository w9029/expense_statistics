/* global jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        app: 'expense-statistics-server',
        env: 'test',
        now: '2026-05-09T00:00:00.000Z',
      },
    }),
  }),
);
