import "dotenv/config";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });

export interface EnvConfig {
  port: number;
  database: {
    url: string;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || "";
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

export function loadConfig(): EnvConfig {
  return {
    port: getEnvNumber("AI_API_PORT", 3001),
    database: {
      url: getEnv("DATABASE_URL"),
    },
  };
}
