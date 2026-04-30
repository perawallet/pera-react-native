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
import { useRoute } from '@react-navigation/native'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useAppNavigation } from '@hooks/useAppNavigation'

import type { RouteProp } from '@react-navigation/native'
import type { RekeyToSharedStackParamList } from '../../routes/types'

export type UseRekeyToSharedSuccessScreenResult = {
    sourceName: string
    handleDone: () => void
}

export const useRekeyToSharedSuccessScreen =
    (): UseRekeyToSharedSuccessScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RekeyToSharedStackParamList, 'RekeyToSharedSuccess'>
            >()
        const source = useFindAccountByAddress(route.params.sourceAddress)

        const handleDone = useCallback(() => {
            navigation.navigate('TabBar', { screen: 'Home' })
        }, [navigation])

        return {
            sourceName: source?.name ?? '',
            handleDone,
        }
    }
