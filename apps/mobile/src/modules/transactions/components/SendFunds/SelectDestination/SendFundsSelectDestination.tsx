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

import { PWHeader, PWText, PWView } from '@components/core'
import { AddressSearchView } from '@components/AddressSearchView'
import { useMemo } from 'react'
import { useSendFunds } from '@modules/transactions/hooks'
import { useStyles } from './styles'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { useTheme } from '@rneui/themed'
import { EmptyView } from '@components/EmptyView'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'

export type SendFundsSelectDestinationProps = {
    onNext: () => void
    onBack: () => void
}

export const SendFundsSelectDestination = ({
    onNext,
    onBack,
}: SendFundsSelectDestinationProps) => {
    const { selectedAsset, setDestination } = useSendFunds()
    const styles = useStyles()
    const { data: assets } = useAssetsQuery()
    const asset = useMemo(() => {
        if (!selectedAsset?.assetId) return null
        return assets.get(selectedAsset?.assetId)
    }, [selectedAsset, assets])
    const { theme } = useTheme()
    const { t } = useLanguage()

    const handleSelected = (address: string) => {
        setDestination(address)
        onNext()
    }

    if (!selectedAsset || !asset) {
        return (
            <EmptyView
                title={t('send_funds.destination.error_title')}
                body={t('send_funds.destination.error_body')}
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <PWHeader
                leftIcon='chevron-left'
                onLeftPress={onBack}
            >
                <PWView style={styles.assetTitleContainer}>
                    <AssetIcon
                        asset={asset}
                        size={theme.spacing.xl}
                    />
                    <PWText>{asset.name}</PWText>
                </PWView>
            </PWHeader>
            <AddressSearchView onSelected={handleSelected} />
        </PWView>
    )
}
