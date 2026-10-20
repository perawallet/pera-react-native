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

import { afterEach, describe, expect, test } from 'vitest'
import {
    ledgerAppDriverRegistry,
    type LedgerAppDriver,
} from '@perawallet/wallet-extension-hardware-wallet'
import { hasLedgerAppDriver } from '../drivers'

describe('hasLedgerAppDriver', () => {
    afterEach(() => {
        ledgerAppDriverRegistry.reset()
    })

    test('is true only for a chain whose device app is registered', () => {
        ledgerAppDriverRegistry.register({
            chainId: 'registered',
            open: () => {
                throw new Error('not opened in this test')
            },
        } as unknown as LedgerAppDriver)

        expect(hasLedgerAppDriver('registered')).toBe(true)
        expect(hasLedgerAppDriver('other')).toBe(false)
    })
})
