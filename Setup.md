# Initalize Project
```bash
npx create-next-app@latest . --yes
```

# Package Initialization

## Database and Auth Related Packages
```bash
npm install drizzle-orm postgres better-auth @better-auth/drizzle-adapter
npm install -D drizzle-kit
```

For generating auth related database tables, we will use
```bash
npx auth@latest generate --config "src/lib/auth/auth.ts" --output "src/db/schemas/auth.ts"
```
This will generate tables according to **Better Auth Service.**
