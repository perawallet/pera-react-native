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

import { useCallback } from 'react'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useDappConnectionsStore } from '@modules/settings/hooks/useDappConnectionsStore'
import type { DappPermission } from '@perawallet/wallet-extension-platform-chrome'

export type UseConnectedSitesScreenResult = {
    sites: DappPermission[]
    isLoading: boolean
    handleRevoke: (origin: string) => void
    keyExtractor: (item: DappPermission) => string
}

export const useConnectedSitesScreen = (): UseConnectedSitesScreenResult => {
    const { t } = useLanguage()
    const { sites, isLoading, revoke } = useDappConnectionsStore()
    const { request: requestBottomSheet } = useBottomSheet()

    const confirmRevoke = useCallback(
        async (origin: string) => {
            const confirmed = await requestBottomSheet<boolean>({
                contents: (
                    <ConfirmActionContent
                        icon='trash'
                        iconVariant='error'
                        title={t('settings.connected_sites.revoke_title')}
                        message={t('settings.connected_sites.revoke_body', {
                            origin,
                        })}
                        confirmLabel={t(
                            'settings.connected_sites.revoke_confirm',
                        )}
                        cancelLabel={t(
                            'settings.connected_sites.revoke_cancel',
                        )}
                        confirmVariant='destructive'
                        testID='connected_sites_revoke_confirm_bottom_sheet'
                        confirmTestID='connected_sites_revoke_confirm_button'
                        cancelTestID='connected_sites_revoke_cancel_button'
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!confirmed) return
            await revoke(origin)
        },
        [requestBottomSheet, revoke, t],
    )

    const handleRevoke = useCallback(
        (origin: string) => {
            void confirmRevoke(origin)
        },
        [confirmRevoke],
    )

    const keyExtractor = useCallback((item: DappPermission) => item.origin, [])

    return { sites, isLoading, handleRevoke, keyExtractor }
}
