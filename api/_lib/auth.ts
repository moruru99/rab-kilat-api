import { betterAuth } from 'better-auth';

let _auth: Awaited<ReturnType<typeof betterAuth>> | null = null;
let _authError: Error | null = null;

async function initAuth() {
  const [{ drizzleAdapter }, { db }, authSchema] = await Promise.all([
    import('@better-auth/drizzle-adapter'),
    import('./db'),
    import('./auth-schema'),
  ]);

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectURI: (process.env.BETTER_AUTH_URL || 'http://localhost:5173') + '/api/auth/callback/google',
      },
    },
  });
}

export async function getAuth() {
  if (_auth) return _auth;
  if (_authError) throw _authError;
  try {
    _auth = await initAuth();
    return _auth;
  } catch (err: any) {
    _authError = err;
    throw err;
  }
}
