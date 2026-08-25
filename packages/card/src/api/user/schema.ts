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
import { httpsUrlSchema } from '@perawallet/wallet-core-shared'

// GET /v1/user. Only the fields the card feature needs are modelled; unknown
// fields are stripped by Zod.
export const userResponseSchema = z.object({
    id: z.string(),
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    countryOfResidence: z.string().optional().nullable(),
    verificationState: z.string(),
})
export type UserApiResponse = z.infer<typeof userResponseSchema>

// GET /v1/user/verification — starts/returns the Veriff KYC session URL. The
// caller hands it to Linking.openURL, so the scheme is gated here.
export const verificationSessionResponseSchema = z.object({
    sessionUrl: httpsUrlSchema,
})
export type VerificationSessionApiResponse = z.infer<
    typeof verificationSessionResponseSchema
>
