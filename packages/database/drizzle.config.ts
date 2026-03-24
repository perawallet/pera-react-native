import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './src/schema/*.ts',
    out: './src/migrations',
    dialect: 'sqlite',
})
