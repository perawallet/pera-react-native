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

import { useCallback, useMemo } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { useDappRequest } from '../../hooks/useDappRequest.web'

type UseWcErrorScreenResult = {
    error: Error | null
    isLoading: boolean
    handleAcknowledge: () => void
}

// The single button settles the approval so the bridge closes the window and
// the host's one-surface guard reopens.
export const useWcErrorScreen = (): UseWcErrorScreenResult => {
    const { t } = useLanguage()
    const { approval, isLoading, reject } = useDappRequest()

    const notice = approval?.kind === 'connection-error' ? approval : undefined

    const error = useMemo(() => {
        if (!notice) return null
        // WalletConnectErrorContent renders `t(error.message)` with no values
        // of its own, so the message arrives localised and interpolated.
        return new Error(
            t('walletconnect.request.error_network_mismatch', {
                active: t(
                    `walletconnect.request.networks_${notice.activeNetwork}`,
                ),
            }),
        )
    }, [t, notice])

    const handleAcknowledge = useCallback((): void => {
        void reject()
    }, [reject])

    return { error, isLoading, handleAcknowledge }
}
