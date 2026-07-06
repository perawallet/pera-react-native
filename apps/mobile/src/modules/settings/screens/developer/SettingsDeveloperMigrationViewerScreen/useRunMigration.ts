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

import { useCallback, useState } from 'react'
import {
    useCreateAccount,
    useImportAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    runMigration,
    type MigrationRunResult,
} from '@perawallet/wallet-core-migrate'

export type UseRunMigrationResult = {
    run: () => Promise<MigrationRunResult>
    isMigrating: boolean
    result: MigrationRunResult | null
    error: Error | null
}

export const useRunMigration = (): UseRunMigrationResult => {
    const importAccount = useImportAccount()
    const { createHdWalletAccountForSeed } = useCreateAccount()
    const { createHDWalletKey, hasSeedWithEntropy } = useKMS()
    const markAccountBackedUp = useMarkMnemonicBackupComplete()
    const [isMigrating, setIsMigrating] = useState(false)
    const [result, setResult] = useState<MigrationRunResult | null>(null)
    const [error, setError] = useState<Error | null>(null)

    const run = useCallback(async (): Promise<MigrationRunResult> => {
        setIsMigrating(true)
        setResult(null)
        setError(null)
        try {
            const runResult = await runMigration(getProvider().migration, {
                importAccount,
                createHdWalletAccount: createHdWalletAccountForSeed,
                createHDWalletKey,
                hasSeedWithEntropy,
                markAccountBackedUp,
            })
            setResult(runResult)
            return runResult
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e))
            setError(err)
            throw err
        } finally {
            setIsMigrating(false)
        }
    }, [
        importAccount,
        createHdWalletAccountForSeed,
        createHDWalletKey,
        hasSeedWithEntropy,
        markAccountBackedUp,
    ])

    return { run, isMigrating, result, error }
}
