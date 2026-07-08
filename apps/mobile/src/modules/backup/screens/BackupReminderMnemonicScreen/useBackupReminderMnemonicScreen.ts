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

import { useCallback, useEffect, useState } from 'react'
import {
    type RouteProp,
    useNavigation,
    useRoute,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { usePinCode } from '@perawallet/wallet-core-security'
import { logger } from '@perawallet/wallet-core-shared'
import { useMnemonicForAddress } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupReminderMnemonicScreenResult = {
    wordIndices: Uint16Array | null
    isLoading: boolean
    error: Error | null
    isPinVisible: boolean
    isPinGateResolved: boolean
    handlePinVerified: () => void
    onContinue: () => void
}

export const useBackupReminderMnemonicScreen =
    (): UseBackupReminderMnemonicScreenResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<
                    BackupStackParamList,
                    'BackupMnemonic'
                >
            >()
        const route =
            useRoute<RouteProp<BackupStackParamList, 'BackupMnemonic'>>()
        const address = route.params?.address
        const account = useAccountsStore(
            state => state.accounts.find(a => a.address === address) ?? null,
        )
        const { checkPinEnabled } = usePinCode()
        const [isPinGateResolved, setIsPinGateResolved] = useState(false)
        const [isPinVisible, setIsPinVisible] = useState(false)
        const { executeWithMnemonic } = useMnemonicForAddress(address, account)
        const [indices, setIndices] = useState<Uint16Array | null>(null)
        const [isLoading, setIsLoading] = useState(true)
        const [error, setError] = useState<Error | null>(null)
        const [focusToken, setFocusToken] = useState(0)

        // Defense-in-depth: if any caller reaches this screen without going
        // through BackupReminderWriteDownScreen (e.g. future deep link, new
        // navigation entry), re-check the PIN before exposing the mnemonic.
        useEffect(() => {
            let cancelled = false
            void (async () => {
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

        useEffect(() => {
            if (!isPinGateResolved) return
            let cancelled = false
            setIsLoading(true)
            setError(null)
            executeWithMnemonic(src => {
                // Retain a zeroable copy of the index buffer; the words are
                // derived at render and never put into state. executeWithMnemonic
                // wipes its own copy once this handler returns.
                if (!cancelled) setIndices(src.slice())
            })
                .catch(err => {
                    logger.error(
                        'BackupMnemonic: failed to retrieve mnemonic',
                        {
                            error:
                                err instanceof Error
                                    ? err.message
                                    : String(err),
                            stack: err instanceof Error ? err.stack : undefined,
                        },
                    )
                    if (!cancelled) setError(err as Error)
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false)
                })
            return () => {
                cancelled = true
            }
        }, [isPinGateResolved, executeWithMnemonic, focusToken])

        // Zero the retained index buffer before dropping it so the phrase
        // doesn't linger in memory waiting on GC.
        const clearIndices = useCallback(() => {
            setIndices(previous => {
                zeroBytes(previous)
                return null
            })
        }, [])

        // Native stack keeps this screen mounted while verification sits on top,
        // so returning fires a focus event, not a remount; re-fetch on focus.
        useEffect(() => {
            return navigation.addListener('focus', () =>
                setFocusToken(previous => previous + 1),
            )
        }, [navigation])

        // Clear the buffer when the host unmounts so the phrase doesn't linger
        // on a detached fiber.
        useEffect(() => () => clearIndices(), [clearIndices])

        const handlePinVerified = useCallback(() => {
            setIsPinVisible(false)
            setIsPinGateResolved(true)
        }, [])

        const onContinue = useCallback(() => {
            if (!address) return
            // Zero the buffer before leaving so the phrase doesn't linger in
            // memory behind the verification screen; returning re-fetches it.
            clearIndices()
            navigation.navigate('BackupVerification', { address })
        }, [address, navigation, clearIndices])

        return {
            // The component resolves each word from the index buffer at render
            // (see mnemonicIndexToWord); the full phrase is never held as a
            // string array here.
            wordIndices: indices,
            isLoading,
            error,
            isPinVisible,
            isPinGateResolved,
            handlePinVerified,
            onContinue,
        }
    }
