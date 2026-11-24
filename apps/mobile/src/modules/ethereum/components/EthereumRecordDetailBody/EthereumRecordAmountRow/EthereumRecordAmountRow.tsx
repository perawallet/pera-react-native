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

import type {
    BalanceChange,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useEthereumRecordAmountRow } from './useEthereumRecordAmountRow'

type EthereumRecordAmountRowProps = {
    change: BalanceChange
    scope: ChainScope
    testID: string
}

export const EthereumRecordAmountRow = ({
    change,
    scope,
    testID,
}: EthereumRecordAmountRowProps) => {
    const { title, asset, value, isLoading, showSymbol } =
        useEthereumRecordAmountRow(change, scope)

    return (
        <KeyValueRow
            testID={testID}
            title={title}
        >
            <AssetAmount
                chainId={scope.chainId}
                asset={asset}
                value={value}
                isLoading={isLoading}
                showSymbol={showSymbol}
                ignorePrivacyMode
            />
        </KeyValueRow>
    )
}
