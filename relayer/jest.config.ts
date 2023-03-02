import type { Config } from "jest";

export default async (): Promise<Config> => {
  return {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
      "^@/(.*)$": "<rootDir>/src/$1",
      "^~/(.*)$": "<rootDir>/tests/$1",
    },
    testPathIgnorePatterns: ["build"],
    resetMocks: true,
    collectCoverageFrom: ["src/**/*.ts*"],
  };
};
