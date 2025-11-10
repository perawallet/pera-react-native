import { z } from 'zod'

export const contactSchema = z.object({
    name: z
        .string('Please enter a valid name')
        .min(1, { message: 'Please enter a valid name' }),
    address: z
        .string('Please enter a valid Algorand address')
        .regex(new RegExp('^[a-zA-Z0-9]{58}$'), {
            message: 'Please enter a valid Algorand address',
        }),
    //TODO we can probably do better with the NFD regex
    nfd: z
        .string()
        .regex(new RegExp('.*\\..*$'), {
            message: 'Please enter a valid NF Domain name',
        })
        .optional(),
})
