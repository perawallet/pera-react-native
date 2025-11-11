/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
