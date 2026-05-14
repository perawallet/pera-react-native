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

import { useState, useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    useAllAccounts,
    useSelectedAccountAddress,
    useAccountsStore,
    type MultiSigAccount,
} from '@perawallet/wallet-core-accounts'
import { useCreateMultisigAccountMutation } from '@perawallet/wallet-core-multisig'
import {
    generateMultisigAddress,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationLock } from '@hooks/useNavigationLock'
import { useToast } from '@hooks/useToast'
import {
    useShouldPlayConfetti,
    useExitAccountFlow,
} from '@modules/onboarding/hooks'
import { useMultisigCreationStore } from '../../hooks/useMultisigCreation'
import { getNextSharedAccountName } from '../../utils'
import type { MultisigStackParamList } from '../../routes/types'

type UseNameMultisigScreenResult = {
    accountName: string
    isCreating: boolean
    isFinishDisabled: boolean
    handleNameChange: (value: string) => void
    handleFinish: () => void
}

export const useNameMultisigScreen = (): UseNameMultisigScreenResult => {
    // When `params` is present the screen names an imported (QR-scanned)
    // shared account; otherwise it names one built via the creation flow.
    const { params: importParams } =
        useRoute<RouteProp<MultisigStackParamList, 'NameMultisig'>>()

    const storeParticipants = useMultisigCreationStore(
        state => state.participants,
    )
    const storeThreshold = useMultisigCreationStore(state => state.threshold)
    const resetState = useMultisigCreationStore(state => state.resetState)

    const addresses = useMemo(
        () =>
            importParams
                ? importParams.addresses
                : storeParticipants.map(p => p.address),
        [importParams, storeParticipants],
    )
    const threshold = importParams ? importParams.threshold : storeThreshold
    const version = importParams ? importParams.version : 1

    const accounts = useAllAccounts()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { exitAccountFlow } = useExitAccountFlow()
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const createMultisigMutation = useCreateMultisigAccountMutation({
        network,
    })

    const [accountName, setAccountName] = useState(() =>
        getNextSharedAccountName(accounts, t('multisig.name.default_name')),
    )
    const [isCreating, setIsCreating] = useState(false)
    useNavigationLock(isCreating)

    // Account names are not required to be unique — multiple accounts may
    // share a name. The only hard constraint is the account address, checked
    // in `handleFinish` below.
    const trimmedName = accountName.trim()
    const isFinishDisabled = isCreating || trimmedName === ''

    const handleNameChange = useCallback((value: string) => {
        setAccountName(value)
    }, [])

    const handleFinish = useCallback(async () => {
        if (isCreating) return

        try {
            setIsCreating(true)

            await new Promise(resolve => requestAnimationFrame(resolve))

            const multisigAddress =
                importParams?.address ??
                generateMultisigAddress(version, threshold, addresses)

            if (!deviceId) {
                errorToast(t('errors.general.title'), t('errors.general.body'))
                return
            }

            const alreadyExists = accounts.some(
                a => a.address === multisigAddress,
            )
            if (alreadyExists) {
                errorToast(
                    t('multisig.name.duplicate_account_title'),
                    t('multisig.name.duplicate_account_body'),
                )
                return
            }

            await createMultisigMutation.mutateAsync({
                version,
                threshold,
                participant_addresses: addresses,
                device_id: deviceId,
            })

            const newAccount: MultiSigAccount = {
                type: 'multisig',
                address: multisigAddress,
                name: accountName,
                multisigDetails: {
                    threshold,
                    addresses,
                },
            }

            setAccounts([...accounts, newAccount])
            setSelectedAccountAddress(multisigAddress)
            setShouldPlayConfetti(true)
            resetState()
            exitAccountFlow()
        } catch (error) {
            errorToast(
                t('multisig.name.error_title'),
                t('multisig.name.error_message', {
                    error: `${error}`,
                }),
            )
        } finally {
            setIsCreating(false)
        }
    }, [
        isCreating,
        deviceId,
        importParams,
        addresses,
        threshold,
        version,
        accountName,
        accounts,
        setAccounts,
        createMultisigMutation,
        setSelectedAccountAddress,
        setShouldPlayConfetti,
        resetState,
        exitAccountFlow,
        errorToast,
        t,
    ])

    return {
        accountName,
        isCreating,
        isFinishDisabled,
        handleNameChange,
        handleFinish,
    }
}
