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

import { PWText, PWView } from '@components/core'
import { AddressSearchView } from '@components/AddressSearchView'
import { useStyles } from './styles'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useSelectDestinationScreen } from './useSelectDestinationScreen'

export const SelectDestinationScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const { asset, selectedAsset, selectedAccount, handleSelected } =
        useSelectDestinationScreen()

    useNavigationHeader({
        title: asset ? (
            <PWView style={styles.assetTitleContainer}>
                <AssetIcon
                    asset={asset}
                    size='md'
                />
                <PWText>{asset.name}</PWText>
            </PWView>
        ) : undefined,
    })

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
            <AddressSearchView
                onSelected={handleSelected}
                excludeAddress={selectedAccount?.address}
            />
        </PWView>
    )
}
