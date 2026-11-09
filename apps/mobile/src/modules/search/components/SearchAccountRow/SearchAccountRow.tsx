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

import type { StyleProp, ViewStyle } from 'react-native'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { PWText } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { useStyles } from './styles'
import { useSearchAccountRow } from './useSearchAccountRow'

export type SearchAccountRowProps = {
    account: WalletAccount
    /** The chain the search matched the account on; unset or the home chain reads as a plain account row. */
    chainId: Optional<ChainId>
    query: string
    style?: StyleProp<ViewStyle>
}

export const SearchAccountRow = ({
    account,
    chainId,
    query,
    style,
}: SearchAccountRowProps) => {
    const styles = useStyles()
    const { searchedChainId, segments, chainName } = useSearchAccountRow({
        account,
        chainId,
        query,
    })

    if (searchedChainId === undefined) {
        return (
            <AccountDisplay
                account={account}
                showChevron={false}
                style={style}
            />
        )
    }

    return (
        <AccountDisplay
            account={account}
            chainId={searchedChainId}
            showChainBadge
            showChevron={false}
            style={style}
            secondaryContent={
                <PWText
                    variant='body'
                    style={styles.secondary}
                    numberOfLines={1}
                    testID='search_matched_address'
                >
                    {segments.map(({ text, isMatch }, index) =>
                        isMatch ? (
                            <PWText
                                key={`${index}-${text}`}
                                variant='body'
                                weight={500}
                                style={styles.match}
                            >
                                {text}
                            </PWText>
                        ) : (
                            text
                        ),
                    )}
                    {` · ${chainName}`}
                </PWText>
            }
        />
    )
}
