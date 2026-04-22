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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useMnemonicForAddress } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupMnemonicScreenResult = {
    words: string[]
    isLoading: boolean
    error: Error | null
    isPinVisible: boolean
    isPinGateResolved: boolean
    handlePinVerified: () => void
    handlePinClose: () => void
    onContinue: () => void
}

export const useBackupMnemonicScreen = (): UseBackupMnemonicScreenResult => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<BackupStackParamList, 'BackupMnemonic'>
        >()
    const route = useRoute<RouteProp<BackupStackParamList, 'BackupMnemonic'>>()
    const address = route.params?.address
    const account = useAccountsStore(
        state => state.accounts.find(a => a.address === address) ?? null,
    )
    const { checkPinEnabled } = usePinCode()
    const [isPinGateResolved, setIsPinGateResolved] = useState(false)
    const [isPinVisible, setIsPinVisible] = useState(false)

    // Defense-in-depth: if any caller reaches this screen without going
    // through BackupWriteDownScreen (e.g. future deep link, new navigation
    // entry), re-check the PIN before exposing the mnemonic.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const isPinEnabled = await checkPinEnabled()
            if (cancelled) return
            if (isPinEnabled) {
                setIsPinVisible(true)
            } else {
                setIsPinGateResolved(true)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [checkPinEnabled])

    const { mnemonicBytes, error, isLoading, clearMnemonic } =
        useMnemonicForAddress(address, account, isPinGateResolved)

    // Decode-and-split happens per render, but JS strings are immutable so we
    // can't wipe them — the real defense is clearing `mnemonicBytes` as soon
    // as the user leaves this screen. The derived `words` array is dropped
    // with the component.
    const words = useMemo(() => {
        if (!mnemonicBytes) return []
        return new TextDecoder().decode(mnemonicBytes).split(' ')
    }, [mnemonicBytes])

    const handlePinVerified = useCallback(() => {
        setIsPinVisible(false)
        setIsPinGateResolved(true)
    }, [])

    const handlePinClose = useCallback(() => {
        setIsPinVisible(false)
        navigation.goBack()
    }, [navigation])

    const onContinue = useCallback(() => {
        if (!address) return
        // Zero the mnemonic bytes before navigating forward — the verification
        // screen will independently pull only the N words it needs from the
        // KMS, so we don't carry the full phrase through flow state.
        clearMnemonic()
        navigation.navigate('BackupVerification', { address })
    }, [address, clearMnemonic, navigation])

    return {
        words,
        isLoading,
        error,
        isPinVisible,
        isPinGateResolved,
        handlePinVerified,
        handlePinClose,
        onContinue,
    }
}
