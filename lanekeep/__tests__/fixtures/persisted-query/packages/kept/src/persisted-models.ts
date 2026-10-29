import { z } from 'zod'
import type { Decimal } from 'decimal.js'

export interface WithDate {
    createdAt: Date
}

export interface Outer {
    inner: WithDate
}

export interface WithSet {
    ids: Set<string>
}

export interface WithReadonlySet {
    ids: ReadonlySet<string>
}

export interface Tagged {
    amount: Decimal
    bytes: Uint8Array
    big: bigint
    byId: Map<string, string>
    readOnlyById: ReadonlyMap<string, string>
}

export interface RawWithIso {
    createdAt: string
}

export interface WithFormatter {
    format: () => Date
}

export interface Item {
    id: string
}

export const datedSchema = z.object({ at: z.coerce.date() })
export type Dated = z.infer<typeof datedSchema>

export const stampedSchema = z
    .object({ at: z.string() })
    .transform(v => ({ at: new Date(v.at) }))
export type Stamped = z.infer<typeof stampedSchema>

export const checkedSchema = z
    .string()
    .refine(s => !Number.isNaN(new Date(s).getTime()))
export type Checked = z.infer<typeof checkedSchema>

export const consumedSchema = z
    .object({ at: z.string(), ids: z.array(z.string()) })
    .transform(v => ({
        at: new Date(v.at).toISOString(),
        ids: [...new Set(v.ids)],
        copy: Array.from(new Set(v.ids)),
    }))
export type Consumed = z.infer<typeof consumedSchema>
