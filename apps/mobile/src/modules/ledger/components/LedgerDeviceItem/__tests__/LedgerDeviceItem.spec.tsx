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

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { LedgerDeviceItem } from '../LedgerDeviceItem'

import type {
    HardwareWalletDevice,
    LedgerTransportType,
} from '@perawallet/wallet-core-hardware-wallet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const makeDevice = (
    overrides: { name?: string; transportType?: LedgerTransportType } = {},
): HardwareWalletDevice => ({
    id: 'device-1',
    name: overrides.name ?? 'Nano X 1234',
    manufacturer: 'ledger',
    transportType: overrides.transportType ?? 'ble',
    model: 'nanoX',
    rssi: null,
})

describe('LedgerDeviceItem', () => {
    it('strips control and bidi characters from the advertised name', () => {
        render(
            <LedgerDeviceItem
                device={makeDevice({
                    name: 'Nano\u202eX \u200b 1234',
                })}
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('NanoX 1234')).toBeTruthy()
    })

    it('shows a Bluetooth badge for a BLE device', () => {
        render(
            <LedgerDeviceItem
                device={makeDevice({ transportType: 'ble' })}
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('ledger.scan.transport_ble')).toBeTruthy()
    })

    it('shows a USB badge for a USB device', () => {
        render(
            <LedgerDeviceItem
                device={makeDevice({ transportType: 'usb' })}
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('ledger.scan.transport_usb')).toBeTruthy()
    })

    it('reports the pressed device', () => {
        const onPress = vi.fn()
        const device = makeDevice()
        render(
            <LedgerDeviceItem
                device={device}
                onPress={onPress}
            />,
        )

        fireEvent.click(screen.getByTestId('ledger_device_item_device-1'))

        expect(onPress).toHaveBeenCalledWith(device)
    })
})
