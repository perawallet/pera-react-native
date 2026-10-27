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

import type { ResultsFile } from './types'

export const serializeResults = (file: ResultsFile): string =>
    JSON.stringify(file, null, 2)

export const parseResultsFile = (json: string): ResultsFile => {
    const parsed = JSON.parse(json) as Partial<ResultsFile> | null
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Not a results file')
    }
    if (parsed.version !== 1) {
        throw new Error(
            `Unsupported results version: ${String(parsed.version)}`,
        )
    }
    if (!parsed.meta || typeof parsed.meta !== 'object') {
        throw new Error('Results file has no meta')
    }
    if (!Array.isArray(parsed.runs)) {
        throw new Error('Results file has no runs')
    }
    return parsed as ResultsFile
}
