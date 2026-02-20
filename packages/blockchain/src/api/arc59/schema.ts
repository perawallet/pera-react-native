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

export const arc59WarningMessageSchema = z.object({
    title: z.string(),
    detail: z.string(),
    link: z.string(),
    link_text: z.string(),
})

export const arc59SendSummaryResponseSchema = z.object({
    is_arc59_opted_in: z.boolean(),
    minimum_balance_requirement: z.number(),
    inner_tx_count: z.number(),
    total_protocol_and_mbr_fee: z.number(),
    inbox_address: z.string().nullable(),
    algo_fund_amount: z.number(),
    warning_message: arc59WarningMessageSchema.nullable(),
})

export type Arc59SendSummaryResponse = z.infer<
    typeof arc59SendSummaryResponseSchema
>
export type Arc59WarningMessage = z.infer<typeof arc59WarningMessageSchema>
