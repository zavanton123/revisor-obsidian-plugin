/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */

// Pin timezone so date/rollover tests are stable in CI (UTC) and locally.
process.env.TZ = 'America/Sao_Paulo';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};
