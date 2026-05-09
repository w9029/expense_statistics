const isTest = process.env.BABEL_ENV === 'test' || process.env.NODE_ENV === 'test';

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './src',
          '@expense-statistics/api-client': isTest
            ? './__mocks__/api-client.ts'
            : '../frontend/packages/api-client/src/index.ts',
          '@expense-statistics/domain': isTest
            ? './__mocks__/domain.ts'
            : '../frontend/packages/domain/src/index.ts',
        },
        extensions: ['.ios.ts', '.ios.tsx', '.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ],
};
