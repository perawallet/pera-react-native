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

import React from 'react'
import {
    PWView,
    PWText,
    PWTouchableOpacity,
    PWIcon,
    PWChip,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { sanitizeDeviceName } from '../../utils'
import { useStyles } from './styles'

import type {
    HardwareWalletDevice,
    LedgerTransportType,
} from '@perawallet/wallet-core-hardware-wallet'

type LedgerDeviceItemProps = {
    device: HardwareWalletDevice
    onPress: (device: HardwareWalletDevice) => void
}

// On Android the same physical Ledger can be reachable over BLE and USB at
// once — the badge is what distinguishes the two otherwise identical rows.
const TRANSPORT_LABEL_KEY: Record<LedgerTransportType, string> = {
    ble: 'ledger.scan.transport_ble',
    usb: 'ledger.scan.transport_usb',
}

export const LedgerDeviceItem = ({
    device,
    onPress,
}: LedgerDeviceItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

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
                    {sanitizeDeviceName(device.name)}
                </PWText>
            </PWView>

            <PWChip
                title={t(TRANSPORT_LABEL_KEY[device.transportType])}
                variant='secondary'
                textVariant='captionSmall'
                style={styles.transportBadge}
            />

            <PWIcon
                name='chevron-right'
                size='sm'
                variant='secondary'
            />
        </PWTouchableOpacity>
    )
}
