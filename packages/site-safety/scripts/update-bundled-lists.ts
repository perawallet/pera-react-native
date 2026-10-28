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

// Refreshes the snapshot that ships with each release. Run before cutting one:
// pnpm update:phishing-lists
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isCompleteList, PHISHING_LIST_SOURCES } from '../src/sources'
import type { PhishingListSnapshot } from '../src/models'

const OUTPUT = resolve(
    import.meta.dirname,
    '../src/bundled/phishing-lists.json',
)

const join = (hosts: readonly string[]): string => [...hosts].sort().join('\n')

const main = async (): Promise<void> => {
    const sources = {} as PhishingListSnapshot['sources']
    for (const source of PHISHING_LIST_SOURCES) {
        const response = await fetch(source.url)
        if (!response.ok) {
            throw new Error(`${source.id}: HTTP ${response.status}`)
        }
        const entries = source.parse(await response.json())
        if (!entries || !isCompleteList(source, entries)) {
            throw new Error(`${source.id}: malformed or truncated list`)
        }
        sources[source.id] = {
            deny: join(entries.deny),
            allow: join(entries.allow),
            impersonationTargets: join(entries.impersonationTargets),
            addresses: join(entries.addresses),
        }
        console.log(
            `${source.id}: ${entries.deny.length} deny entries, ${entries.addresses.length} addresses`,
        )
    }
    const snapshot: PhishingListSnapshot = {
        generatedAt: new Date().toISOString(),
        sources,
    }
    writeFileSync(OUTPUT, `${JSON.stringify(snapshot)}\n`)
}

await main()
