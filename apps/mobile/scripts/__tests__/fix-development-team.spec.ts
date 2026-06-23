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

import { describe, expect, it } from 'vitest'
import {
    resolveTeamId,
    sanitizeDevelopmentTeam,
} from '../fix-development-team'

describe('fix-development-team helpers', () => {
    it('resolves the team id from IOS_TEAM_ID first', () => {
        expect(resolveTeamId({ IOS_TEAM_ID: '87QL82XC78' })).toBe('87QL82XC78')
    })

    it('falls back to APPLE_TEAM_ID then empty string', () => {
        expect(resolveTeamId({ APPLE_TEAM_ID: 'FALLBACKID' })).toBe('FALLBACKID')
        expect(resolveTeamId({})).toBe('')
    })

    it('prefers IOS_TEAM_ID over APPLE_TEAM_ID when both are set', () => {
        expect(
            resolveTeamId({ IOS_TEAM_ID: '87QL82XC78', APPLE_TEAM_ID: 'OTHER' }),
        ).toBe('87QL82XC78')
    })

    it('quotes an unquoted $(DEVELOPMENT_TEAM) placeholder to the resolved team', () => {
        const input = 'DEVELOPMENT_TEAM = $(DEVELOPMENT_TEAM);'

        expect(sanitizeDevelopmentTeam(input, '87QL82XC78')).toBe(
            'DEVELOPMENT_TEAM = "87QL82XC78";',
        )
    })

    it('rewrites an already-quoted placeholder too', () => {
        const input = 'DEVELOPMENT_TEAM = "$(DEVELOPMENT_TEAM)";'

        expect(sanitizeDevelopmentTeam(input, '87QL82XC78')).toBe(
            'DEVELOPMENT_TEAM = "87QL82XC78";',
        )
    })

    it('leaves a concrete team id unchanged', () => {
        const input = 'DEVELOPMENT_TEAM = 87QL82XC78;'

        expect(sanitizeDevelopmentTeam(input, '87QL82XC78')).toBe(input)
    })
})
