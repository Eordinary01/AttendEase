module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.{js,jsx}'],
  setupFiles: ['<rootDir>/testSetup/globals.js'],
  setupFilesAfterSetup: ['<rootDir>/testSetup/setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^axios$': '<rootDir>/__mocks__/axios.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(axios|msw|@mswjs|framer-motion|@headlessui|lucide-react|@heroicons|recharts|d3-[^*]+|internmap|robust-predicates)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/__tests__/**',
    '!src/setupTests.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 15000,
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'jsx', 'json'],
};
