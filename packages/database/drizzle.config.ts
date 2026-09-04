import { defineConfig } from 'drizzle-kit'

// NOTE: after `db:generate`, hand-correct `decimalColumn` defaults in the
// emitted SQL from drizzle-kit's `'"0"'` to `'0'`. `decimalColumn.fromDriver`
// (src/columns.ts) does `new Decimal(String(value))`, which throws on the
// JSON-quoted form. The migration file repeats this note for the same reason.
export default defineConfig({
    schema: [
        '../assets/src/db/schema.ts',
        '../accounts/src/db/schema.ts',
        '../transactions/src/db/schema.ts',
        '../nfd/src/db/schema.ts',
        '../signing/src/db/schema.ts',
    ],
    out: './src/migrations',
    dialect: 'sqlite',
})
