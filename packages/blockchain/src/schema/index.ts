import { z } from 'zod'
import { MAX_TX_NOTE_BYTES } from '../models'

export const noteSchema = z.object({
    note: z
        .string()
        .refine(data => Buffer.from(data).byteLength <= MAX_TX_NOTE_BYTES, {
            error: 'Notes may not exceed 1kb in length',
        })
        .optional(),
})