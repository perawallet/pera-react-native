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
    useRoute,
    type RouteProp,
    useNavigation,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { indicesToMnemonicWords } from '@perawallet/wallet-core-kms'
import { usePinCode } from '@perawallet/wallet-core-security'
import { logger } from '@perawallet/wallet-core-shared'
import { useMnemonicForAddress } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupReminderMnemonicScreenResult = {
    words: string[]
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
        const [words, setWords] = useState<string[]>([])
        const [isLoading, setIsLoading] = useState(true)
        const [error, setError] = useState<Error | null>(null)

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
            executeWithMnemonic(indices => {
                if (!cancelled) setWords(indicesToMnemonicWords(indices))
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
        }, [isPinGateResolved, executeWithMnemonic])

        // Overwrite each slot in the existing array before dereferencing so the
        // previously decoded phrase doesn't linger in memory waiting on GC.
        const clearWords = useCallback(() => {
            setWords(previous => {
                previous.fill('')
                return []
            })
        }, [])

        // Clear the decoded words when the host unmounts so the phrase doesn't
        // linger on a detached fiber.
        useEffect(() => () => clearWords(), [clearWords])

        const handlePinVerified = useCallback(() => {
            setIsPinVisible(false)
            setIsPinGateResolved(true)
        }, [])

        const onContinue = useCallback(() => {
            if (!address) return
            // Native-stack keeps this screen mounted after navigate(), so the
            // unmount cleanup won't fire yet — clear eagerly here. The
            // verification screen pulls only the N words it needs from the KMS,
            // so we don't carry the full phrase through flow state.
            clearWords()
            navigation.navigate('BackupVerification', { address })
        }, [address, navigation, clearWords])

        return {
            words,
            isLoading,
            error,
            isPinVisible,
            isPinGateResolved,
            handlePinVerified,
            onContinue,
        }
    }
