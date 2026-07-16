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

import { describe, expect, it } from 'vitest'
import { parseStakingProjectsConfig } from '../parseStakingProjectsConfig'

const VALID_PROJECT = {
    id: 'folks',
    title: 'Folks Finance',
    description: 'Stake your Algo to receive xALGO.',
    logoUrl: 'https://example.com/logo.png',
    link: 'https://app.folks.finance',
    type: 'liquid',
}

describe('parseStakingProjectsConfig', () => {
    it('returns an empty array when raw is empty', () => {
        expect(parseStakingProjectsConfig('')).toEqual([])
    })

    it('returns an empty array when raw is whitespace-only', () => {
        expect(parseStakingProjectsConfig('   \n\t')).toEqual([])
    })

    it('parses a valid projects array', () => {
        const raw = JSON.stringify([VALID_PROJECT])
        const result = parseStakingProjectsConfig(raw)

        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            id: 'folks',
            title: 'Folks Finance',
        })
    })

    it('throws a descriptive error for invalid JSON', () => {
        expect(() => parseStakingProjectsConfig('not-json')).toThrow(
            'Invalid staking projects remote config JSON',
        )
    })

    it('throws when the payload fails schema validation', () => {
        const raw = JSON.stringify([{ id: 'folks' }]) // missing required fields

        expect(() => parseStakingProjectsConfig(raw)).toThrow()
    })
})
