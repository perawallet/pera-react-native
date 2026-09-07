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

import { useCallback } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useWebView } from '@modules/webview'
import { useAppNavigation } from '@hooks/useAppNavigation'

import type { AppStackParamList } from '@routes/types'

export type RekeyIntroNavConfig = {
    parentRoute: keyof Pick<
        AppStackParamList,
        'RekeyToStandard' | 'RekeyToLedger' | 'RekeyToShared' | 'RekeyToQuantum'
    >
    selectTargetScreen:
        | 'RekeyToStandardSelectTarget'
        | 'RekeyToLedgerSelectTarget'
        | 'RekeyToSharedSelectTarget'
        | 'RekeyToQuantumSelectTarget'
    supportUrl: string
}

export type UseRekeyIntroScreenResult = {
    handleStartProcess: () => void
    handleLearnMore: () => void
}

// Every rekey-intro route is registered with the same `{ sourceAddress }`
// params, so this route-agnostic hook types them with a shared shape rather
// than a per-module `RouteProp`.
type RekeyIntroRoute = RouteProp<{ intro: { sourceAddress: string } }, 'intro'>

export const useRekeyIntroScreen = (
    navConfig: RekeyIntroNavConfig,
): UseRekeyIntroScreenResult => {
    const navigation = useAppNavigation()
    const { pushWebView } = useWebView()
    const { sourceAddress } = useRoute<RekeyIntroRoute>().params ?? {
        sourceAddress: '',
    }

    const handleStartProcess = useCallback(() => {
        navigation.navigate(navConfig.parentRoute, {
            screen: navConfig.selectTargetScreen,
            params: { sourceAddress },
        })
    }, [
        navigation,
        navConfig.parentRoute,
        navConfig.selectTargetScreen,
        sourceAddress,
    ])

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: navConfig.supportUrl })
    }, [pushWebView, navConfig.supportUrl])

    return {
        handleStartProcess,
        handleLearnMore,
    }
}
