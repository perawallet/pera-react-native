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

const nonEmptyString = z.string().trim().min(1)

const stakingTypeSchema = z.enum(['liquid', 'pools', 'delegated'])

const stakingProjectInfoSchema = z.object({
    id: nonEmptyString,
    title: nonEmptyString,
    description: nonEmptyString,
    logoUrl: nonEmptyString,
    link: nonEmptyString,
    type: stakingTypeSchema,
})

export const stakingProjectsConfigSchema = z
    .array(stakingProjectInfoSchema)
    .refine(
        projects => {
            const ids = projects.map(p => p.id)
            return new Set(ids).size === ids.length
        },
        { message: 'Duplicate staking project ids found' },
    )

export type StakingType = z.infer<typeof stakingTypeSchema>

export type StakingProjectInfo = z.infer<typeof stakingProjectInfoSchema>

const stakingProjectTvlSchema = z.object({
    tvl_in_algo: z.string().nullable(),
    tvl_in_usd: z.string().nullable(),
})

export const stakingProjectsApiResponseSchema = z.record(
    z.string(),
    stakingProjectTvlSchema,
)

export type StakingProjectsApiResponse = z.infer<
    typeof stakingProjectsApiResponseSchema
>
