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

import { useState } from 'react'
import { usePollingStore } from '../store'
import { useShouldRefreshMutation } from './useShouldRefreshMutation'

const CACHE_CHECK_INTERVAL = 3000

export const usePolling = () => {
    const setLastRefreshedRound = usePollingStore(
        state => state.setLastRefreshedRound,
    )
    const { mutateAsync } = useShouldRefreshMutation()
    const [polling, setPolling] = useState<NodeJS.Timeout | null>(null)

    const doCheck = async () => {
        try {
            const response = await mutateAsync()

            if (response.refresh) {
                //TODO: can we be a bit more selective of which queries we reset?
                //queryClient.resetQueries()
                //setLastRefreshedRound(response.round ?? null)
            }
        } catch (error) {
            console.log('Polling failed:')
            console.log(error)
        }
    }

    const startPolling = async () => {
        const timer = setInterval(doCheck, CACHE_CHECK_INTERVAL)
        setPolling(timer)
    }

    const stopPolling = async () => {
        if (polling) {
            clearTimeout(polling)
            setPolling(null)
        }
    }

    return {
        startPolling,
        stopPolling,
    }
}
