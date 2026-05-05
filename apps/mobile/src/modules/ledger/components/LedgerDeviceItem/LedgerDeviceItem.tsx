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

type LedgerDeviceItemProps = {
    device: HardwareWalletDevice
    onPress: (device: HardwareWalletDevice) => void
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
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={() => onPress(device)}
            testID={`ledger_device_item_${device.id}`}
        >
            <PWView style={styles.iconContainer}>
                <PWIcon
                    name='ledger'
                    size='sm'
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

            <PWView
                style={styles.transportBadge}
                testID={`ledger_device_item_${device.id}_transport_${device.transportType}`}
            >
                <PWText
                    variant='caption'
                    style={styles.transportBadgeText}
                >
                    {device.transportType === 'usb' ? 'USB' : 'BLE'}
                </PWText>
            </PWView>

            <PWIcon
                name='chevron-right'
                size='sm'
                variant='secondary'
            />
        </PWTouchableOpacity>
    )
}
