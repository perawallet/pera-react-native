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

import type { DeviceIdOrigin } from '@perawallet/wallet-core-device'
import type { LegacyDeviceIdentifiers } from '@perawallet/wallet-extension-platform'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { LegacyVsRnRow } from '../components/LegacyVsRnRow'
import { MigrationDataRow } from '../components/MigrationDataRow'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

const deviceIdOriginStatusOf = (origin: Nullable<DeviceIdOrigin>): string => {
    switch (origin) {
        case 'migrated': {
            return 'migrated id active'
        }
        case 'recreated': {
            return 'recreated — migrated id replaced'
        }
        case null: {
            return 'not from migration'
        }
        default: {
            const exhaustive: never = origin
            return exhaustive
        }
    }
}

const describeDeviceIdOrigin = (
    id: Nullable<string>,
    origin: Nullable<DeviceIdOrigin>,
): string => {
    return `${id ?? 'null'} (${deviceIdOriginStatusOf(origin)})`
}

type DeviceIdentifiersSectionProps = {
    deviceIdentifiers: LegacyDeviceIdentifiers
    rn: RNMigrationSnapshot
}

export const DeviceIdentifiersSection = ({
    deviceIdentifiers,
    rn,
}: DeviceIdentifiersSectionProps) => {
    return (
        <MigrationDataSection title='Device Identifiers'>
            <MigrationDataRow
                label='notificationUserId'
                value={deviceIdentifiers.notificationUserId}
            />
            <LegacyVsRnRow
                label='mainnetDeviceId'
                legacyValue={deviceIdentifiers.mainnetDeviceId}
                rnValue={rn.deviceIDs.mainnet}
                matches={
                    deviceIdentifiers.mainnetDeviceId === rn.deviceIDs.mainnet
                }
            />
            <MigrationDataRow
                label='mainnetDeviceIdOrigin'
                value={describeDeviceIdOrigin(
                    rn.deviceIDs.mainnet,
                    rn.deviceIdOrigins.mainnet,
                )}
            />
            <LegacyVsRnRow
                label='testnetDeviceId'
                legacyValue={deviceIdentifiers.testnetDeviceId}
                rnValue={rn.deviceIDs.testnet}
                matches={
                    deviceIdentifiers.testnetDeviceId === rn.deviceIDs.testnet
                }
            />
            <MigrationDataRow
                label='testnetDeviceIdOrigin'
                value={describeDeviceIdOrigin(
                    rn.deviceIDs.testnet,
                    rn.deviceIdOrigins.testnet,
                )}
            />
            <MigrationDataRow
                label='lastSeenNotificationId'
                value={deviceIdentifiers.lastSeenNotificationId}
            />
        </MigrationDataSection>
    )
}
