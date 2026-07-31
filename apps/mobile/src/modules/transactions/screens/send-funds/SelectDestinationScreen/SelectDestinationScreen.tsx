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

import { PWScreen, PWText, PWView } from '@components/core'
import { AddressSearchView } from '@components/AddressSearchView'
import { useStyles } from './styles'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useSelectDestinationScreen } from './useSelectDestinationScreen'
import { LoadingView } from '@components/LoadingView'

export const SelectDestinationScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        selectedAsset,
        handleSelected,
        isCheckingExternalOptIn,
        isAutoAdvancing,
    } = useSelectDestinationScreen()

    useNavigationHeader({
        title: selectedAsset ? (
            <PWView style={styles.assetTitleContainer}>
                <AssetIcon
                    asset={selectedAsset}
                    size='md'
                />
                <PWText>{selectedAsset.name}</PWText>
            </PWView>
        ) : undefined,
    })

    // A deeplink-prefilled destination routes through automatically — show a
    // spinner (never the error EmptyView or the picker) until it resolves.
    if (isAutoAdvancing) {
        return <LoadingView variant='circle' />
    }

    if (!selectedAsset) {
        return (
            <EmptyView
                title={t('send_funds.destination.error_title')}
                body={t('send_funds.destination.error_body')}
            />
        )
    }

    if (isCheckingExternalOptIn) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
        >
            <AddressSearchView onSelected={handleSelected} />
        </PWScreen>
    )
}
