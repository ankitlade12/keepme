type ClerkEnvironment = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
};

export function clerkConfigured(
  environment: ClerkEnvironment = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  },
) {
  return Boolean(
    environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
    environment.CLERK_SECRET_KEY?.trim(),
  );
}
