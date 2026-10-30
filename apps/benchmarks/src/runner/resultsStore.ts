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

import * as Clipboard from 'expo-clipboard'
import { File, Paths } from 'expo-file-system'
import { Share } from 'react-native'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { parseResultsFile, serializeResults } from './resultsFile'
import type { ResultsFile } from './types'

// In Documents, so a result outlives the app being killed mid-run.
const fileFor = (name: string): File => new File(Paths.document, name)

const save = (name: string, results: ResultsFile): void => {
    const file = fileFor(name)
    file.create({ overwrite: true })
    file.writeSync(serializeResults(results))
}

const load = (name: string): Nullable<ResultsFile> => {
    const file = fileFor(name)
    return file.exists ? parseResultsFile(file.textSync()) : null
}

export const saveLatest = (results: ResultsFile): void =>
    save('bench-latest.json', results)
export const loadLatest = (): Nullable<ResultsFile> => load('bench-latest.json')
export const saveBaseline = (results: ResultsFile): void =>
    save('bench-baseline.json', results)
export const loadBaseline = (): Nullable<ResultsFile> =>
    load('bench-baseline.json')

export const exportResults = async (results: ResultsFile): Promise<void> => {
    await Share.share({ message: serializeResults(results) })
}

export const importBaselineFromClipboard = async (): Promise<ResultsFile> =>
    parseResultsFile(await Clipboard.getStringAsync())
