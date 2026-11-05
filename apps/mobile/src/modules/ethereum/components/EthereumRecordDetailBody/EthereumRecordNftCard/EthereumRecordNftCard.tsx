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
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { CollectibleThumbnail } from '@modules/assets'
import { TransactionDetailCard } from '@modules/signing'
import type { EthereumRecordNft } from '@modules/ethereum/hooks/useEthereumRecordNft'
import { useStyles } from './styles'

// Physical pixels for the Prism resize: a 48pt thumbnail on a 3x display.
const THUMBNAIL_WIDTH = 144

type EthereumRecordNftCardProps = {
    nft: EthereumRecordNft
    scope: ChainScope
    /** Unset while the NFT has no metadata to open. */
    onPress?: () => void
}

export const EthereumRecordNftCard = ({
    nft,
    scope,
    onPress,
}: EthereumRecordNftCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <TransactionDetailCard testID='ethereum_record_nft'>
            <PWTouchableOpacity
                testID='ethereum_record_nft_open'
                style={styles.header}
                onPress={onPress}
                disabled={!onPress}
                accessibilityRole={onPress ? 'button' : undefined}
            >
                <CollectibleThumbnail
                    thumbnailUrl={nft.thumbnailUrl}
                    imageStyle={styles.image}
                    placeholderStyle={styles.placeholder}
                    iconSize='md'
                    imageWidth={THUMBNAIL_WIDTH}
                />
                <PWView style={styles.names}>
                    <PWText
                        variant='bodyLarge'
                        numberOfLines={2}
                        testID='ethereum_record_nft_title'
                    >
                        {nft.title}
                    </PWText>
                    {!!nft.subtitle && (
                        <PWText
                            variant='caption'
                            style={styles.subtitle}
                            numberOfLines={1}
                            testID='ethereum_record_nft_subtitle'
                        >
                            {nft.subtitle}
                        </PWText>
                    )}
                </PWView>
                {!!onPress && (
                    <PWIcon
                        name='chevron-right'
                        variant='secondary'
                    />
                )}
            </PWTouchableOpacity>
            <KeyValueRow
                testID='ethereum_record_nft_quantity'
                title={t('transactions.record_detail.quantity')}
            >
                <PWText>{nft.quantity}</PWText>
            </KeyValueRow>
            <KeyValueRow
                testID='ethereum_record_nft_token_id'
                title={t('asset_details.collectible.token_id')}
            >
                <AddressDisplay
                    address={nft.tokenId}
                    scope={scope}
                    displayType='address-only'
                    addressFormat='short'
                    textProps={{ variant: 'body' }}
                />
            </KeyValueRow>
            <KeyValueRow
                testID='ethereum_record_nft_contract'
                title={t('asset_details.collectible.contract')}
            >
                <AddressDisplay
                    address={nft.contract}
                    scope={scope}
                    displayType='address-only'
                    addressFormat='short'
                    textProps={{ variant: 'body' }}
                />
            </KeyValueRow>
        </TransactionDetailCard>
    )
}
