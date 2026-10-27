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
import { parseResultsFile, serializeResults } from '../resultsFile'
import type { ResultsFile } from '../types'

const FILE: ResultsFile = {
    version: 1,
    meta: {
        platform: 'ios',
        deviceModel: 'iPhone 15',
        osVersion: '18.1',
        isDevBuild: false,
        scalesHash: 'abc',
        chains: ['algorand'],
        startedAt: '2026-10-26T10:00:00.000Z',
    },
    runs: [],
}

describe('results file', () => {
    it('round trips', () => {
        expect(parseResultsFile(serializeResults(FILE))).toEqual(FILE)
    })

    it('refuses a version it does not know', () => {
        expect(() =>
            parseResultsFile(JSON.stringify({ ...FILE, version: 2 })),
        ).toThrow(/version/)
    })

    it('refuses a file with no runs', () => {
        expect(() =>
            parseResultsFile(JSON.stringify({ version: 1, meta: FILE.meta })),
        ).toThrow(/runs/)
    })

    it('refuses a file with no meta', () => {
        expect(() =>
            parseResultsFile(JSON.stringify({ version: 1, runs: [] })),
        ).toThrow(/meta/)
    })

    it('refuses text that is not JSON', () => {
        expect(() => parseResultsFile('not a baseline')).toThrow()
    })
})
