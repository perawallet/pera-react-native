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

import {
    PWFlatList,
    PWIcon,
    PWImage,
    PWScreen,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useConnectedSitesScreen } from './useConnectedSitesScreen'
import { useStyles } from './styles'

import type { DappPermission } from '@perawallet/wallet-extension-platform-chrome'

type ConnectedSiteRowProps = {
    site: DappPermission
    onRevoke: (origin: string) => void
}

const ConnectedSiteRow = ({ site, onRevoke }: ConnectedSiteRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.siteRow}
            testID={`connected_site_row_${site.origin}`}
        >
            {site.iconUrl ? (
                <PWImage
                    source={{ uri: site.iconUrl }}
                    style={styles.icon}
                />
            ) : (
                <PWIcon
                    name='globe'
                    style={styles.icon}
                />
            )}
            <PWView style={styles.siteInfo}>
                <PWText
                    variant='h4'
                    numberOfLines={1}
                    style={styles.siteName}
                >
                    {site.name ?? site.origin}
                </PWText>
                <PWText
                    variant='caption'
                    numberOfLines={1}
                    style={styles.siteOrigin}
                >
                    {site.origin}
                </PWText>
                <PWText
                    variant='caption'
                    style={styles.accountsCount}
                >
                    {t('settings.connected_sites.accounts_count', {
                        count: site.addresses.length,
                    })}
                </PWText>
            </PWView>
            <PWTouchableIcon
                name='trash'
                variant='secondary'
                onPress={() => onRevoke(site.origin)}
                testID={`connected_site_revoke_${site.origin}`}
            />
        </PWView>
    )
}

export const ConnectedSitesScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { sites, isLoading, handleRevoke, keyExtractor } =
        useConnectedSitesScreen()

    const renderItem = ({ item }: { item: DappPermission }) => (
        <ConnectedSiteRow
            site={item}
            onRevoke={handleRevoke}
        />
    )

    return (
        <PWScreen
            scroll='never'
            testID='connected_sites_screen'
        >
            <PWFlatList
                contentContainerStyle={styles.listContainer}
                data={sites}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListEmptyComponent={
                    <EmptyView
                        style={styles.emptyView}
                        icon='globe'
                        isLoading={isLoading}
                        title={t('settings.connected_sites.empty_title')}
                        body={t('settings.connected_sites.empty_body')}
                    />
                }
            />
        </PWScreen>
    )
}
