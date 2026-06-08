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

import { useCallback, useState } from 'react'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { usePollingStore } from '../store'
import { useShouldRefreshMutation } from './useShouldRefreshMutation'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { onlineManager } from '@tanstack/react-query'

const CACHE_CHECK_INTERVAL = 3000

type UsePollingOptions = {
    onRefresh?: () => void
}

export const usePolling = (options?: UsePollingOptions) => {
    const { network } = useNetwork()
    const setLastRefreshedRound = usePollingStore(
        state => state.setLastRefreshedRound,
    )
    const { mutateAsync } = useShouldRefreshMutation()
    const [polling, setPolling] =
        useState<Nullable<ReturnType<typeof setInterval>>>(null)

    const doCheck = useCallback(async () => {
        if (!onlineManager.isOnline) {
            return
        }

        try {
            const response = await mutateAsync()

            if (response.refresh) {
                setLastRefreshedRound(network, response.round ?? null)
                options?.onRefresh?.()
            }
        } catch (error) {
            console.log('Polling failed:')
            console.log(error)
        }
    }, [mutateAsync, network, options?.onRefresh])

    const stopPolling = useCallback(async () => {
        if (polling) {
            clearTimeout(polling)
            setPolling(null)
        }
    }, [polling])

    const startPolling = useCallback(async () => {
        void stopPolling()
        const timer = setInterval(() => {
            void doCheck()
        }, CACHE_CHECK_INTERVAL)
        setPolling(timer)
    }, [doCheck, stopPolling])

    return {
        startPolling,
        stopPolling,
    }
}
