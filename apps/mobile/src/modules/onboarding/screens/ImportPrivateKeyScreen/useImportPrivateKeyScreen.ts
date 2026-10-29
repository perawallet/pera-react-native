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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    parsePrivateKey,
    isValidPrivateKeyInput,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useCloudBackupStore } from '@perawallet/wallet-core-backup'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useErrorToast } from '@hooks/useErrorToast'
import { useIsCloudBackupEnabled } from '@hooks/useIsCloudBackupEnabled'
import { useIsMounted } from '@hooks/useIsMounted'
import { useLanguage } from '@hooks/useLanguage'
import type { ImportFlowParamList } from '@modules/onboarding/routes/types'

export type UseImportPrivateKeyScreenResult = {
    chainName: string
    hasInput: boolean
    isValidInput: boolean
    isImporting: boolean
    isIncludedInCloudBackup: boolean
    handleChangeText: (text: string) => void
    handleImport: () => void
}

export const useImportPrivateKeyScreen =
    (): UseImportPrivateKeyScreenResult => {
        const navigation = useAppNavigation()
        const isMounted = useIsMounted()
        const { t } = useLanguage()
        const { showError } = useErrorToast()
        const { chainId } =
            useRoute<RouteProp<ImportFlowParamList, 'ImportPrivateKey'>>()
                .params
        const { chains } = getProvider()
        const chainName = chains.has(chainId)
            ? chains.get(chainId).descriptor.displayName
            : chainId

        const isCloudBackupEnabled = useIsCloudBackupEnabled()
        const isChainBackedUp = useCapability({
            chain: { chainId, capability: 'cloudBackup' },
        })
        const isCloudBackupConfigured = useCloudBackupStore(state =>
            state.isConfigured(),
        )
        const isIncludedInCloudBackup =
            isCloudBackupEnabled && isChainBackedUp && isCloudBackupConfigured

        // The typed key lives only here, never in state, so a re-render can't
        // copy it into the tree; it's dropped as soon as it's been read.
        const inputRef = useRef('')
        const [hasInput, setHasInput] = useState(false)
        const [isValidInput, setIsValidInput] = useState(false)
        const [isImporting, setIsImporting] = useState(false)
        // State lags a second tap landing before the re-render, so the guard
        // reads a ref; that tap would otherwise parse the cleared input.
        const isImportingRef = useRef(false)

        useEffect(
            () => () => {
                inputRef.current = ''
            },
            [],
        )

        const handleChangeText = useCallback(
            (text: string) => {
                inputRef.current = text
                setHasInput(text.length > 0)
                setIsValidInput(isValidPrivateKeyInput(chainId, text))
            },
            [chainId],
        )

        const handleImport = useCallback(() => {
            if (isImportingRef.current || !isValidInput) return
            isImportingRef.current = true
            setIsImporting(true)
            void (async () => {
                let privateKey: Optional<Uint8Array>
                try {
                    privateKey = parsePrivateKey(chainId, inputRef.current)
                    inputRef.current = ''
                    const account = await useAccountsStore
                        .getState()
                        .importAccountFromPrivateKey(chainId, privateKey)
                    if (!isMounted()) return
                    navigation.push('NameAccount', { account, chainId })
                } catch (error) {
                    inputRef.current = ''
                    if (!isMounted()) return
                    // The field keeps its masked text, but the key it held is
                    // gone, so submitting again needs it entered again.
                    setHasInput(false)
                    setIsValidInput(false)
                    showError(
                        error,
                        t('onboarding.import_private_key.error_title'),
                    )
                } finally {
                    // The store zeroes the bytes it was handed; this covers a
                    // throw before they reached it.
                    zeroBytes(privateKey)
                    isImportingRef.current = false
                    if (isMounted()) setIsImporting(false)
                }
            })()
        }, [chainId, isValidInput, isMounted, navigation, showError, t])

        return {
            chainName,
            hasInput,
            isValidInput,
            isImporting,
            isIncludedInCloudBackup,
            handleChangeText,
            handleImport,
        }
    }
