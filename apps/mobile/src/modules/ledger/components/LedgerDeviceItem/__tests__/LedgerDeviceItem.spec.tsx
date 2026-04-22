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

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'
import { LedgerDeviceItem } from '../LedgerDeviceItem'

const makeDevice = (
    overrides: Partial<HardwareWalletDevice> = {},
): HardwareWalletDevice =>
    ({
        id: 'device-1',
        name: 'Fred Nano X',
        model: 'nanoX',
        rssi: -55,
        manufacturer: 'ledger',
        ...overrides,
    }) as HardwareWalletDevice

describe('LedgerDeviceItem', () => {
    it('renders the device name', () => {
        render(
            <LedgerDeviceItem
                device={makeDevice()}
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('Fred Nano X')).toBeTruthy()
    })

    it('renders the model display name for known models', () => {
        render(
            <LedgerDeviceItem
                device={makeDevice({ model: 'flex' })}
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('Flex')).toBeTruthy()
    })

    it('falls back to "Ledger" for unknown models', () => {
        render(
            <LedgerDeviceItem
                device={makeDevice({ model: 'something-new' })}
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('Ledger')).toBeTruthy()
    })

    it('calls onPress with the device when tapped', () => {
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
