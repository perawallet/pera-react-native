/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { uint64IdSchema } from '@perawallet/wallet-core-shared'
import { projectResponseSchema } from '../projects/schema'

export const applicationResponseSchema = z.object({
    // uint64 app id — normalized to a decimal string (see uint64IdSchema).
    application_id: uint64IdSchema,
    name: z.string(),
    project: projectResponseSchema,
})

export type ApplicationApiResponse = z.infer<typeof applicationResponseSchema>
