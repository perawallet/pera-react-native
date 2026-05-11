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

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAccountsStore,
    useSetAccounts,
    useSelectedAccountAddress,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'
import type { HardwareWalletTransport } from '@perawallet/wallet-core-hardware-wallet'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import {
    verifyLedgerAddress,
    LedgerProviderNotFoundError,
    classifyLedgerError,
} from '@perawallet/wallet-core-ledger'
import type { AppError, Nullable } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import {
    useExitAccountFlow,
    useShouldPlayConfetti,
} from '@modules/onboarding/hooks'
import {
    getLedgerErrorPreset,
    type LedgerErrorPreset,
} from '@modules/ledger/utils'

type LedgerVerifyRouteProp = RouteProp<AddAccountStackParamList, 'LedgerVerify'>

type UseLedgerVerifyScreenResult = {
    selectedAccounts: ReadonlyArray<LedgerAccount>
    verifiedIndices: ReadonlySet<number>
    areAllVerified: boolean
    errorPreset: Nullable<LedgerErrorPreset>
    handleAdd: () => void
    handleRetry: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

type VerificationState = 'connecting' | 'verifying' | 'complete' | 'error'

export const useLedgerVerifyScreen = (): UseLedgerVerifyScreenResult => {
    const {
        params: {
            deviceId,
            deviceName,
            transportType = 'ble',
            selectedAccounts,
        },
    } = useRoute<LedgerVerifyRouteProp>()
    const { t } = useLanguage()
    const { setAccounts } = useSetAccounts()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { exitAccountFlow } = useExitAccountFlow()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const navigation = useAppNavigation()

    const [verificationState, setVerificationState] =
        useState<VerificationState>('connecting')
    const [verifiedIndices, setVerifiedIndices] = useState<ReadonlySet<number>>(
        () => new Set(),
    )
    const [error, setError] = useState<Nullable<AppError>>(null)
    const hasStartedRef = useRef(false)

    const verify = useCallback(async () => {
        let transport: Nullable<HardwareWalletTransport> = null
        try {
            setVerificationState('connecting')
            setError(null)
            setVerifiedIndices(new Set())

            const provider = getProvider().hardwareWalletRegistry.getProvider(
                'ledger',
                transportType,
            )
            if (!provider) {
                throw new LedgerProviderNotFoundError(
                    `No Ledger provider registered for transport "${transportType}"`,
                )
            }

            transport = await provider.connect(deviceId)
            setVerificationState('verifying')

            for (let i = 0; i < selectedAccounts.length; i++) {
                await verifyLedgerAddress(
                    transport,
                    selectedAccounts[i].accountIndex,
                )
                setVerifiedIndices(prev => {
                    const next = new Set(prev)
                    next.add(i)
                    return next
                })
            }

            setVerificationState('complete')
        } catch (err) {
            const verifyError = classifyLedgerError(err)
            setError(verifyError)
            setVerificationState('error')
        } finally {
            if (transport) {
                await transport.disconnect().catch(() => {})
            }
        }
    }, [deviceId, transportType, selectedAccounts])

    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true
        verify()
    }, [verify])

    const handleAdd = useCallback(() => {
        const hwAccounts = selectedAccounts.map((acc: LedgerAccount) => ({
            type: AccountTypes.hardware,
            address: acc.address,
            hardwareDetails: {
                manufacturer: 'ledger' as const,
                deviceId,
                deviceName,
                accountIndex: acc.accountIndex,
                transportType,
            },
        }))

        const currentAccounts = useAccountsStore.getState().accounts
        setAccounts([...currentAccounts, ...hwAccounts])
        setSelectedAccountAddress(hwAccounts[0].address)
        setShouldPlayConfetti(true)
        exitAccountFlow()
    }, [
        deviceId,
        deviceName,
        transportType,
        selectedAccounts,
        setAccounts,
        setSelectedAccountAddress,
        setShouldPlayConfetti,
        exitAccountFlow,
    ])

    const handleRetry = useCallback(() => {
        verify()
    }, [verify])

    const handleTroubleshoot = useCallback(() => {
        navigation.navigate('LedgerTroubleshooting')
    }, [navigation])

    const errorPreset = useMemo(
        () =>
            verificationState === 'error' && error !== null
                ? getLedgerErrorPreset(error, t)
                : null,
        [error, verificationState, t],
    )

    const areAllVerified = verifiedIndices.size === selectedAccounts.length

    return {
        selectedAccounts,
        verifiedIndices,
        areAllVerified,
        errorPreset,
        handleAdd,
        handleRetry,
        handleTroubleshoot,
        t,
    }
}
