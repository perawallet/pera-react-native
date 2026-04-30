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
import { Linking } from 'react-native'
import { useRoute } from '@react-navigation/native'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useAppNavigation } from '@hooks/useAppNavigation'

import type { RouteProp } from '@react-navigation/native'
import type { RekeyToSharedStackParamList } from '../../routes/types'

const LEARN_MORE_URL =
    'https://support.perawallet.app/en/article/how-to-rekey-an-algorand-account-with-pera-mobile-13ykjxs/'

export type UseRekeyToSharedIntroScreenResult = {
    sourceAddress: string
    sourceName: string | undefined
    handleStartProcess: () => void
    handleLearnMore: () => void
}

export const useRekeyToSharedIntroScreen =
    (): UseRekeyToSharedIntroScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RekeyToSharedStackParamList, 'RekeyToSharedIntro'>
            >()
        const sourceAddress = route.params.sourceAddress
        const sourceAccount = useFindAccountByAddress(sourceAddress)

        const handleStartProcess = useCallback(() => {
            navigation.navigate('RekeyToShared', {
                screen: 'RekeyToSharedSelectTarget',
                params: { sourceAddress },
            })
        }, [navigation, sourceAddress])

        const handleLearnMore = useCallback(() => {
            Linking.openURL(LEARN_MORE_URL)
        }, [])

        return {
            sourceAddress,
            sourceName: sourceAccount?.name ?? undefined,
            handleStartProcess,
            handleLearnMore,
        }
    }
