/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { Decimal } from 'decimal.js'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import type { LedgerAccountPreviewAsset } from '@perawallet/wallet-core-accounts'
import { PWView, PWText } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { AssetTierChip } from '@modules/assets/components/AssetTierChip'
import LightLedgerAccountIcon from '@assets/icons/accounts/light/ledger-account.svg'
import { useStyles } from './styles'

export const LedgerSectionHeaderRow = ({ title }: { title: string }) => {
    const styles = useStyles()
    return (
        <PWText
            variant='h4'
            style={styles.sectionHeader}
        >
            {title}
        </PWText>
    )
}

type AccountRowProps = {
    address: string
    algoBalance: Decimal
    fiatValue: Decimal
    label: string
    preferredCurrency: string
}

export const LedgerAccountDetailsRow = ({
    address,
    algoBalance,
    fiatValue,
    label,
    preferredCurrency,
}: AccountRowProps) => {
    const styles = useStyles()
    return (
        <PWView style={styles.row}>
            <LightLedgerAccountIcon
                width={40}
                height={40}
            />
            <PWView style={styles.rowText}>
                <PWText
                    variant='body'
                    numberOfLines={1}
                >
                    {truncateAlgorandAddress(address)}
                </PWText>
                <PWText
                    variant='captionSmall'
                    style={styles.secondary}
                >
                    {label}
                </PWText>
            </PWView>
            <PWView style={styles.rowTrailing}>
                <CurrencyDisplay
                    currency='ALGO'
                    value={algoBalance}
                    precision={ALGO_ASSET.decimals}
                    minPrecision={2}
                    showSymbol
                    variant='body'
                />
                <CurrencyDisplay
                    currency={preferredCurrency}
                    value={fiatValue}
                    precision={2}
                    minPrecision={2}
                    showSymbol
                    variant='captionSmall'
                    style={styles.secondary}
                />
            </PWView>
        </PWView>
    )
}

export const LedgerAssetRow = ({
    asset,
    preferredCurrency,
}: {
    asset: LedgerAccountPreviewAsset
    preferredCurrency: string
}) => {
    const styles = useStyles()
    const iconAsset = asset.isAlgo
        ? ALGO_ASSET
        : {
              assetId: asset.assetId,
              name: asset.name,
              unitName: asset.unitName,
              decimals: 0,
          }
    return (
        <PWView style={styles.row}>
            <AssetIcon
                asset={iconAsset}
                size='md'
                logoUrl={asset.logo}
            />
            <PWView style={styles.rowText}>
                <PWText
                    variant='body'
                    numberOfLines={1}
                >
                    {asset.name}
                </PWText>
                <AssetTierChip
                    unitName={asset.unitName}
                    verificationTier={asset.verificationTier}
                />
            </PWView>
            <PWView style={styles.rowTrailing}>
                <CurrencyDisplay
                    currency={asset.isAlgo ? 'ALGO' : asset.unitName || ''}
                    value={asset.amount}
                    precision={asset.isAlgo ? ALGO_ASSET.decimals : 6}
                    minPrecision={2}
                    showSymbol
                    variant='body'
                />
                <CurrencyDisplay
                    currency={preferredCurrency}
                    value={asset.fiatValue}
                    precision={2}
                    minPrecision={2}
                    showSymbol
                    variant='captionSmall'
                    style={styles.secondary}
                />
            </PWView>
        </PWView>
    )
}

export const LedgerRekeyAddressRow = ({ address }: { address: string }) => {
    const styles = useStyles()
    return (
        <PWView style={styles.row}>
            <PWView style={styles.rowText}>
                <PWText
                    variant='body'
                    numberOfLines={1}
                >
                    {truncateAlgorandAddress(address)}
                </PWText>
            </PWView>
        </PWView>
    )
}
