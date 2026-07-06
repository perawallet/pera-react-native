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

import { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '@perawallet/wallet-core-shared'
import {
    useCreateAccount,
    useImportAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { useSecurityStore } from '@perawallet/wallet-core-security'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    runMigration,
    useNeedsMigration,
    type MigrationRunResult,
} from '@perawallet/wallet-core-migrate'

const SUCCESS_DISMISS_DELAY_MS = 3000

export type MigrationSplashStatus = 'running' | 'success' | 'failure'

export type UseMigrationSplashScreenResult = {
    status: MigrationSplashStatus
    failedAccountCount: number
    handleContinue: () => void
    handleSkipPermanently: () => void
}

export const useMigrationSplashScreen = (): UseMigrationSplashScreenResult => {
    const importAccount = useImportAccount()
    const { createHdWalletAccountForSeed } = useCreateAccount()
    const { createHDWalletKey, hasSeedWithEntropy } = useKMS()
    const markAccountBackedUp = useMarkMnemonicBackupComplete()
    const { dismiss, setSkipped } = useNeedsMigration()
    const requestLock = useSecurityStore(state => state.requestLock)

    const [status, setStatus] = useState<MigrationSplashStatus>('running')
    const [failedAccountCount, setFailedAccountCount] = useState(0)

    const importAccountRef = useRef(importAccount)
    importAccountRef.current = importAccount
    const createHdWalletAccountRef = useRef(createHdWalletAccountForSeed)
    createHdWalletAccountRef.current = createHdWalletAccountForSeed
    const createHDWalletKeyRef = useRef(createHDWalletKey)
    createHDWalletKeyRef.current = createHDWalletKey
    const hasSeedWithEntropyRef = useRef(hasSeedWithEntropy)
    hasSeedWithEntropyRef.current = hasSeedWithEntropy
    const markAccountBackedUpRef = useRef(markAccountBackedUp)
    markAccountBackedUpRef.current = markAccountBackedUp
    const dismissRef = useRef(dismiss)
    dismissRef.current = dismiss
    const setSkippedRef = useRef(setSkipped)
    setSkippedRef.current = setSkipped
    const requestLockRef = useRef(requestLock)
    requestLockRef.current = requestLock

    const startedRef = useRef(false)

    useEffect(() => {
        if (startedRef.current) return
        startedRef.current = true

        let cancelled = false
        let successTimer: ReturnType<typeof setTimeout> | null = null

        const run = async () => {
            let result: MigrationRunResult
            try {
                result = await runMigration(getProvider().migration, {
                    importAccount: importAccountRef.current,
                    createHdWalletAccount: createHdWalletAccountRef.current,
                    createHDWalletKey: createHDWalletKeyRef.current,
                    hasSeedWithEntropy: hasSeedWithEntropyRef.current,
                    markAccountBackedUp: markAccountBackedUpRef.current,
                })
            } catch (error) {
                logger.error('[Migration] splash run threw', { error })
                if (cancelled) return
                setFailedAccountCount(0)
                setStatus('failure')
                return
            }

            if (cancelled) return

            if (result.completed) {
                setStatus('success')
                successTimer = setTimeout(() => {
                    requestLockRef.current()
                    dismissRef.current()
                }, SUCCESS_DISMISS_DELAY_MS)
                return
            }

            setFailedAccountCount(result.accounts?.failed.length ?? 0)
            setStatus('failure')
        }

        void run()

        return () => {
            cancelled = true
            if (successTimer !== null) clearTimeout(successTimer)
        }
    }, [])

    const handleContinue = useCallback(() => {
        requestLockRef.current()
        dismissRef.current()
    }, [])

    const handleSkipPermanently = useCallback(() => {
        setSkippedRef.current()
        requestLockRef.current()
        dismissRef.current()
    }, [])

    return {
        status,
        failedAccountCount,
        handleContinue,
        handleSkipPermanently,
    }
}
