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

import type { LegacySchemaReplayResult } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { EmptyDataHint } from '../components/EmptyDataHint'
import { SchemaReplayResultRow } from './SchemaReplayResultRow'

type SchemaReplayResultsSectionProps = {
    results: Record<string, LegacySchemaReplayResult> | undefined
}

export const SchemaReplayResultsSection = ({
    results,
}: SchemaReplayResultsSectionProps) => {
    if (!results) return null
    const entries = Object.entries(results)
    return (
        <MigrationDataSection
            title='Schema replay results'
            count={entries.length}
            initiallyExpanded={entries.some(
                ([, r]) =>
                    r.kind === 'replayed' ||
                    r.kind === 'tooOld' ||
                    r.kind === 'failed',
            )}
        >
            {entries.length === 0 ? (
                <EmptyDataHint />
            ) : (
                entries.map(([dbName, result]) => (
                    <SchemaReplayResultRow
                        key={dbName}
                        dbName={dbName}
                        result={result}
                    />
                ))
            )}
        </MigrationDataSection>
    )
}
