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

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// The delegated LogicSig program signer signs a TEAL program with no
// program-review UI — the card funding flow is its only sanctioned caller
// (it shows a fixed allowance instead). Nothing reachable from a dApp
// transport (WalletConnect / webview / deeplink) may touch it: the pipeline
// resolves signers exclusively through getSigningStrategy (transaction,
// arbitrary-data and ARC-60 signers), and this test pins that boundary.
// Word-bounded so e.g. `signProgram` can't false-flag an unrelated
// `cosignProgrammatic…` identifier.
const FORBIDDEN_REFERENCES = [
    'useProgramSigner',
    'signProgram',
    'signDelegatedLsig',
    'encodeDelegatedLsig',
    'ProgramSigningUnsupportedError',
]

// Everything a sign request flows through: sources → machine → strategies →
// transports. A program-signer reference appearing anywhere here would make
// it reachable from dApp-initiated requests.
const DAPP_REACHABLE_DIRS = ['pipeline', 'machine']

// The shared hooks dApp flows enter the engine through. Their siblings in
// hooks/ include the program signer itself, so the guard names these
// explicitly instead of scanning the whole directory.
const DAPP_ENTRY_HOOKS = [
    'hooks/useSignAndSubmitGroup.ts',
    'hooks/useSigningRequest.ts',
    'hooks/useSigningPipeline.ts',
]

// Tests are excluded: a spec documenting this boundary (or asserting its
// absence) must not trip the firewall it describes.
const listFilesRecursively = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
            return entry.name === '__tests__'
                ? []
                : listFilesRecursively(fullPath)
        }
        return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : []
    })

const findViolations = (files: string[]): string[] =>
    files.flatMap(file => {
        const content = readFileSync(file, 'utf-8')
        return FORBIDDEN_REFERENCES.filter(reference =>
            new RegExp(`\\b${reference}\\b`).test(content),
        ).map(reference => `${file} references ${reference}`)
    })

describe('program signer firewall', () => {
    it('keeps the delegated LogicSig signer helpers out of the signing engine', () => {
        const packageSrc = join(__dirname, '..')

        for (const dir of DAPP_REACHABLE_DIRS) {
            const files = listFilesRecursively(join(packageSrc, dir))
            // Each guarded dir must actually contribute files, so a rename
            // can't silently drop its coverage.
            expect(files.length).toBeGreaterThan(0)
            expect(findViolations(files)).toEqual([])
        }
    })

    it('keeps the delegated LogicSig signer helpers out of the shared dApp entry hooks', () => {
        const packageSrc = join(__dirname, '..')
        const files = DAPP_ENTRY_HOOKS.map(hook => join(packageSrc, hook))

        // Guard against silent renames: every named entry hook must exist.
        for (const file of files) {
            expect(() => readFileSync(file, 'utf-8')).not.toThrow()
        }

        expect(findViolations(files)).toEqual([])
    })
})
