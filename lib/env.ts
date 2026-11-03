import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres@127.0.0.1:55432/repeato_test"),
  PG_POOL_MAX: z.coerce.number().min(1).max(100).default(10),
  PG_SSL: z.enum(["disable", "no-verify", "require"]).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("Repeato <hello@repeato.app>"),
  ENABLE_LIVE_BILLING: z.enum(["true", "false"]).default("false"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let validatedEnv: Env | null = null;

export function getEnv(): Env {
  if (validatedEnv) return validatedEnv;
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment variable validation failed:", result.error.format());
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Fatal: Invalid environment configuration: ${JSON.stringify(result.error.issues)}`);
    }
  }
  validatedEnv = result.data || (process.env as unknown as Env);
  return validatedEnv;
}

