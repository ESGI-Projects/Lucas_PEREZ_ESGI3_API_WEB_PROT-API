import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export function readEnv(input: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Configuration invalide : ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  return result.data;
}
