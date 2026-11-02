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

import { describe, expect, it } from 'vitest'
import { hasSiteToCheck } from '../hasSiteToCheck'

describe('hasSiteToCheck', () => {
    it('is true when any url is present', () => {
        expect(
            hasSiteToCheck({ urls: [undefined, 'https://dapp.example'] }),
        ).toBe(true)
    })

    it('is true for a WalletConnect Verify flag alone', () => {
        expect(
            hasSiteToCheck({ urls: [], isFlaggedByWalletConnectVerify: true }),
        ).toBe(true)
    })

    it('is false when every url is empty or missing and nothing flags it', () => {
        expect(
            hasSiteToCheck({
                urls: [undefined, '', undefined],
                isFlaggedByWalletConnectVerify: false,
            }),
        ).toBe(false)
    })
})
