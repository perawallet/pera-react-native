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

import { PWText, PWView } from '@components/core'
import type { LegacyMigrationData } from '@perawallet/wallet-extension-platform'
import { useStyles } from '../styles'
import { MigrationDataRow } from './MigrationDataRow'

type MigrationSnapshotBannerProps = {
    data: LegacyMigrationData
    isMigrationComplete: boolean
}

export const MigrationSnapshotBanner = ({
    data,
    isMigrationComplete,
}: MigrationSnapshotBannerProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.statusBanner}>
            <PWText
                variant='h4'
                style={styles.statusBannerTitle}
            >
                Legacy migration snapshot
            </PWText>
            <MigrationDataRow
                label='sourcePlatform'
                value={data.sourcePlatform}
            />
            <MigrationDataRow
                label='schemaVersion'
                value={data.schemaVersion}
            />
            <MigrationDataRow
                label='isMigrationComplete'
                value={isMigrationComplete}
            />
        </PWView>
    )
}
