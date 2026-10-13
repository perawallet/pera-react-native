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

import { useEffect } from 'react'
import { useCardSession } from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'

/**
 * Leaves the authenticated card screens for sign-in once the Baanx session
 * is gone. The transport clears the session on an unrecoverable 401, but the
 * dashboard renders from persisted card state, so without this it would stay
 * up over queries that can never load.
 */
export const useCardSessionGuard = (): void => {
    const navigation = useAppNavigation()
    const { isAuthenticated } = useCardSession()

    useEffect(() => {
        if (isAuthenticated) return
        navigation.navigate('PeraCard', { screen: 'CardSignIn' })
    }, [isAuthenticated, navigation])
}
