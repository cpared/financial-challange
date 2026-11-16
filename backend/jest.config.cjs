module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
        module: { type: 'es6' },
      },
    ],
  },
};
