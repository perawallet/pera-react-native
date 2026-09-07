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
import type { LedgerTransportType } from '@perawallet/wallet-core-hardware-wallet'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

import { useBlePermissions } from '../../hooks'
import type { Optional } from '@perawallet/wallet-core-shared'

type LedgerInstructionsRouteParams = {
    LedgerInstructions: Optional<{ transportType?: LedgerTransportType }>
}

type UseLedgerInstructionsScreenResult = {
    isChecking: boolean
    transportType: LedgerTransportType
    handleContinue: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerInstructionsScreen =
    (): UseLedgerInstructionsScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const route =
            useRoute<
                RouteProp<LedgerInstructionsRouteParams, 'LedgerInstructions'>
            >()
        const transportType: LedgerTransportType =
            route.params?.transportType ?? 'ble'

        const { hasPermissions, isChecking, requestPermissions } =
            useBlePermissions()

        const handleContinue = useCallback(async () => {
            // USB doesn't require BLE permissions; skip the BLE permission gate.
            if (transportType === 'usb' || hasPermissions) {
                navigation.navigate('LedgerScan', { transportType })
                return
            }

            const granted = await requestPermissions()
            if (granted) {
                navigation.navigate('LedgerScan', { transportType })
            } else {
                errorToast(
                    t('ledger.instructions.permission_required_title'),
                    t('ledger.instructions.permission_required_message'),
                )
            }
        }, [
            transportType,
            hasPermissions,
            requestPermissions,
            navigation,
            t,
            errorToast,
        ])

        return {
            isChecking,
            transportType,
            handleContinue: () => void handleContinue(),
            t,
        }
    }
