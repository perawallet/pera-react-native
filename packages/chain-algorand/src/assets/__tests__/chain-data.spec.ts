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
import { algorandAssetChainData } from '../chain-data'
import { ALGORAND_NATIVE_ASSET } from '../native-asset'

describe('algorand asset chain data', () => {
    it("keeps the asset's creator and gives it back", () => {
        const asset = {
            ...ALGORAND_NATIVE_ASSET,
            assetId: '31566704',
            creator: { address: 'CREATOR' },
        }

        const stored = algorandAssetChainData.encode(asset)

        expect(stored).toEqual({
            family: 'algorand',
            creatorAddress: 'CREATOR',
        })
        expect(algorandAssetChainData.decode(stored!)).toEqual({
            creator: { address: 'CREATOR' },
        })
    })

    it('gives an empty creator for EVM asset data', () => {
        expect(algorandAssetChainData.decode({ family: 'evm' })).toEqual({
            creator: { address: '' },
        })
    })
})
