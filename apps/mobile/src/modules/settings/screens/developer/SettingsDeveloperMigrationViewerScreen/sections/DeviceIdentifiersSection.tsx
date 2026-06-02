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

import { useLanguage } from '@hooks/useLanguage'
import type { LegacyDeviceIdentifiers } from '@perawallet/wallet-extension-platform'
import {
    CollapsibleSection,
    ComparisonRow,
    InlineRow,
} from '../SettingsDeveloperMigrationViewerScreen'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

export const DeviceIdentifiersSection = ({
    deviceIdentifiers,
    rn,
}: {
    deviceIdentifiers: LegacyDeviceIdentifiers
    rn: RNMigrationSnapshot
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t(
                'settings.developer.migration_viewer.section_device_identifiers',
            )}
        >
            <InlineRow
                label='notificationUserId'
                value={deviceIdentifiers.notificationUserId}
            />
            <ComparisonRow
                label='mainnetDeviceId'
                legacyValue={deviceIdentifiers.mainnetDeviceId}
                rnValue={rn.deviceIDs.mainnet}
                matches={
                    deviceIdentifiers.mainnetDeviceId === rn.deviceIDs.mainnet
                }
            />
            <ComparisonRow
                label='testnetDeviceId'
                legacyValue={deviceIdentifiers.testnetDeviceId}
                rnValue={rn.deviceIDs.testnet}
                matches={
                    deviceIdentifiers.testnetDeviceId === rn.deviceIDs.testnet
                }
            />
            <InlineRow
                label='legacyDeviceId'
                value={deviceIdentifiers.legacyDeviceId}
            />
            <InlineRow
                label='lastSeenNotificationId'
                value={deviceIdentifiers.lastSeenNotificationId}
            />
        </CollapsibleSection>
    )
}
