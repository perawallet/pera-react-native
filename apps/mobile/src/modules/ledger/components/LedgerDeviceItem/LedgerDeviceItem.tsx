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

import React from 'react'
import { PWView, PWText, PWTouchableOpacity, PWIcon } from '@components/core'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

import { useStyles } from './styles'
import type { Nullable } from '@perawallet/wallet-core-shared'

type LedgerDeviceItemProps = {
    device: HardwareWalletDevice
    onPress: (device: HardwareWalletDevice) => void
}

const getSignalLevel = (
    rssi: Nullable<number>,
): 'strong' | 'medium' | 'weak' => {
    if (rssi === null) return 'weak'
    if (rssi >= -60) return 'strong'
    if (rssi >= -80) return 'medium'
    return 'weak'
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
    nanoX: 'Nano X',
    stax: 'Stax',
    flex: 'Flex',
    nanoGen5: 'Nano Gen5',
}

const getModelDisplayName = (model: string): string =>
    MODEL_DISPLAY_NAMES[model] ?? 'Ledger'

export const LedgerDeviceItem = ({
    device,
    onPress,
}: LedgerDeviceItemProps) => {
    const signalLevel = getSignalLevel(device.rssi)
    const styles = useStyles({ signalLevel })

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={() => onPress(device)}
            testID={`ledger_device_item_${device.id}`}
        >
            <PWView style={styles.iconContainer}>
                {/* TODO(PERA-ledger): swap generic wallet icon for the
                    Ledger-specific asset (port from ic_ledger.xml on Android
                    or icon-ledger-account on iOS) once the asset pipeline
                    ships the vector. */}
                <PWIcon
                    name='wallet'
                    size='md'
                />
            </PWView>

            <PWView style={styles.textContainer}>
                <PWText
                    variant='body'
                    style={styles.deviceName}
                >
                    {device.name}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.modelName}
                >
                    {getModelDisplayName(device.model)}
                </PWText>
            </PWView>

            {/* TODO(PERA-ledger): render signal-strength dot using the
                resolved `signalLevel` (RSSI) instead of a single flat dot,
                matching Android's item_scanned_ledger.xml layout
                (strong / medium / weak colors + chevron). */}
            <PWView style={styles.signalContainer}>
                <PWView style={styles.signalDot} />
            </PWView>
        </PWTouchableOpacity>
    )
}
