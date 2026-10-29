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

import { renderHook } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { useLedgerTransportOptionsContent } from '../useLedgerTransportOptionsContent'

const UNSUPPORTED =
    'onboarding.import_account_options.pair_ledger_unsupported_description'

describe('useLedgerTransportOptionsContent', () => {
    it('offers Bluetooth then USB, both enabled when both work', () => {
        const { result } = renderHook(() =>
            useLedgerTransportOptionsContent({
                isBleAvailable: true,
                isUsbAvailable: true,
            }),
        )

        expect(
            result.current.options.map(o => [o.transport, o.isDisabled]),
        ).toEqual([
            ['ble', false],
            ['usb', false],
        ])
    })

    it('disables a transport this device lacks, and says why', () => {
        const { result } = renderHook(() =>
            useLedgerTransportOptionsContent({
                isBleAvailable: false,
                isUsbAvailable: true,
            }),
        )

        const [ble, usb] = result.current.options
        expect(ble).toMatchObject({
            isDisabled: true,
            descriptionKey: UNSUPPORTED,
        })
        expect(usb).toMatchObject({
            isDisabled: false,
            descriptionKey:
                'onboarding.ledger_transport_options.usb_description',
        })
    })
})
