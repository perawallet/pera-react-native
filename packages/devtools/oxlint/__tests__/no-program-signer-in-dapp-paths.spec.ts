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

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
    DAPP_SIGNING_PATHS,
    noProgramSignerInDappPaths,
} from '../rules/no-program-signer-in-dapp-paths.js'

describe('pera/no-program-signer-in-dapp-paths', () => {
    const lintSource = (text: string): string[] => {
        const report = vi.fn()
        noProgramSignerInDappPaths
            .create({ report, sourceCode: { getText: () => text } })
            .Program()
        return report.mock.calls.map(
            ([{ loc, data }]) =>
                `${data.name}@${loc.start.line}:${loc.start.column}`,
        )
    }

    it('reports program-signer names in code, comments and strings', () => {
        expect(
            lintSource(
                [
                    "import { signProgram } from '../program'",
                    '// falls back to useProgramSigner',
                    "const e = 'encodeDelegatedLsig'",
                ].join('\n'),
            ),
        ).toEqual([
            'signProgram@1:9',
            'useProgramSigner@2:17',
            'encodeDelegatedLsig@3:11',
        ])
    })

    it('allows look-alikes', () => {
        expect(
            lintSource(
                'const cosignProgrammatic = 1\nconst signProgramX = 2\n',
            ),
        ).toEqual([])
    })

    it('is enabled for exactly the dApp signing paths, which still exist', () => {
        const root = join(__dirname, '../../../..')
        const config = JSON.parse(
            readFileSync(join(root, '.oxlintrc.json'), 'utf8'),
        ) as {
            overrides: { files: string[]; rules: Record<string, unknown> }[]
        }
        const override = config.overrides.find(
            o => o.rules['pera/no-program-signer-in-dapp-paths'] === 'error',
        )
        expect(override?.files).toEqual(
            DAPP_SIGNING_PATHS.map(p => (p.endsWith('.ts') ? p : `${p}/**`)),
        )
        for (const path of DAPP_SIGNING_PATHS) {
            expect(existsSync(join(root, path)), path).toBe(true)
        }
    })
})
