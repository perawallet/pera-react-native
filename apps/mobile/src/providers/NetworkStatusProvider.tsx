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

import { createContext, PropsWithChildren, useEffect, useState } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { useToast } from '@hooks/toast'
import { LONG_NOTIFICATION_DURATION } from '@constants/ui'

export const NetworkStatusContext = createContext({
    hasInternet: true,
})

export const NetworkStatusProvider = ({ children }: PropsWithChildren) => {
    const { showToast } = useToast()
    const [hasInternet, setHasInternet] = useState(true)
    useEffect(() => {
        const netInfoSubscription = NetInfo.addEventListener(
            (state: NetInfoState) => {
                setHasInternet(state.isConnected !== false)
            },
        )
        return () => {
            netInfoSubscription()
        }
    }, [])

    useEffect(() => {
        if (!hasInternet) {
            showToast(
                {
                    title: 'No Internet Connection',
                    body: 'Some data may not be up to date.',
                    type: 'warning',
                },
                { duration: LONG_NOTIFICATION_DURATION },
            )
        }
    }, [hasInternet, showToast])

    return (
        <NetworkStatusContext.Provider value={{ hasInternet }}>
            {children}
        </NetworkStatusContext.Provider>
    )
}
