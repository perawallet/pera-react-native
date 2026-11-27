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
import type { AssetInboxRequest } from '../../chain-adapter'
import {
    isAssetInboxResolutionBlocked,
    shouldUseAssetInboxFunds,
} from '../assetInboxResolution'

const request = (flags: Partial<AssetInboxRequest>) =>
    ({
        insufficientNativeForClaiming: false,
        insufficientNativeForRejecting: false,
        shouldUseFundsBeforeClaiming: false,
        shouldUseFundsBeforeRejecting: false,
        ...flags,
    }) as AssetInboxRequest

describe('isAssetInboxResolutionBlocked', () => {
    it('blocks a claim the account cannot afford, but not the reject it can', () => {
        const unaffordableClaim = request({
            insufficientNativeForClaiming: true,
        })

        expect(isAssetInboxResolutionBlocked(unaffordableClaim, 'claim')).toBe(
            true,
        )
        expect(isAssetInboxResolutionBlocked(unaffordableClaim, 'reject')).toBe(
            false,
        )
    })

    it('lets an unaffordable resolution through when the inbox funds cover it', () => {
        expect(
            isAssetInboxResolutionBlocked(
                request({
                    insufficientNativeForClaiming: true,
                    shouldUseFundsBeforeClaiming: true,
                }),
                'claim',
            ),
        ).toBe(false)
        expect(
            isAssetInboxResolutionBlocked(
                request({
                    insufficientNativeForRejecting: true,
                    shouldUseFundsBeforeRejecting: true,
                }),
                'reject',
            ),
        ).toBe(false)
    })
})

describe('shouldUseAssetInboxFunds', () => {
    it('reads the flag for the mode asked about', () => {
        const claimOnly = request({ shouldUseFundsBeforeClaiming: true })

        expect(shouldUseAssetInboxFunds(claimOnly, 'claim')).toBe(true)
        expect(shouldUseAssetInboxFunds(claimOnly, 'reject')).toBe(false)
    })
})
