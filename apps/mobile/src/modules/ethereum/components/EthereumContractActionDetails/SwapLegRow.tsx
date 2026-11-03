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

import type { EvmActionAsset } from '@perawallet/wallet-core-chain-ethereum'
import { PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import type { EthereumBoundedAmount } from '../../hooks/useEthereumContractAction'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { ActionAmount } from './ActionAmount'
import { useStyles } from './styles'

type SwapLegRowProps = {
    testID: string
    title: string
    leg: EthereumBoundedAmount
    token: EvmActionAsset
    presentation: EthereumTransactionPresentation
}

// The token's address is always shown: a token record's name is whatever the token calls itself.
export const SwapLegRow = ({
    testID,
    title,
    leg,
    token,
    presentation,
}: SwapLegRowProps) => {
    const styles = useStyles()
    return (
        <KeyValueRow
            testID={testID}
            title={title}
            verticalAlignment='top'
        >
            <PWView style={styles.amount}>
                <ActionAmount
                    amount={leg}
                    presentation={presentation}
                />
                {token.kind === 'token' && (
                    <AddressDisplay
                        testID={`${testID}_token`}
                        address={token.contract}
                        displayType='address-only'
                        scope={presentation.scope}
                    />
                )}
            </PWView>
        </KeyValueRow>
    )
}
