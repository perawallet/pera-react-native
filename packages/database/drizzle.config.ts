import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: [
        '../assets/src/db/schema.ts',
        '../accounts/src/db/schema.ts',
        '../transactions/src/db/schema.ts',
    ],
    out: './src/migrations',
    dialect: 'sqlite',
})
