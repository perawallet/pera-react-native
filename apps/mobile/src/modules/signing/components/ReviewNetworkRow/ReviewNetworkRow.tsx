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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    chainNetworkOf,
} from '@perawallet/wallet-core-chain-shared'
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui/icon'
import { ReviewDetailRow } from '../ReviewDetailRow'
import { useStyles } from './styles'

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: network row chain icon size
const CHAIN_ICON_SIZE = 20

export type ReviewNetworkRowProps = {
    scope: ChainScope
}

export const ReviewNetworkRow = ({ scope }: ReviewNetworkRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { network } = chainNetworkOf(scope)
    const chain = chainDisplayNameOf(scope.chainId) ?? scope.chainId

    return (
        <ReviewDetailRow
            label={t('transactions.common.network')}
            testID='review_network'
        >
            <PWView style={styles.value}>
                <ChainIcon
                    chainId={scope.chainId}
                    size={CHAIN_ICON_SIZE}
                />
                <PWText
                    variant='h4'
                    style={styles.name}
                >
                    {chain}
                </PWText>
                {scope.networkId !== 'mainnet' && (
                    <PWText style={styles.network}>{network}</PWText>
                )}
            </PWView>
        </ReviewDetailRow>
    )
}
