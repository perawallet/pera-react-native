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

import { useMemo, useRef } from 'react'
import { useCreateAccount } from '@perawallet/wallet-core-accounts'
import {
    useCloudBackupContactImport,
    useCloudBackupImport,
    useResolveHdSeedForBackup,
    useResolveMnemonicForBackup,
    useRestoreCloudBackupMutation,
} from '@perawallet/wallet-core-backup'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useLocalKeyTransactionSigner } from '@perawallet/wallet-core-signing'
import { resetBenchState } from './data/resetBenchState'
import type { FixtureNetwork } from './network/fixtureNetwork'
import type { ScenarioContext } from './runner/types'

/**
 * The production hooks the scenarios call, behind one context that never
 * changes identity. A scenario keeps the context from before its setup, and the
 * hooks close over reactive snapshots (the keystore's key list among them), so
 * each call goes to the latest render's function: a key minted in setup is then
 * visible to the signer in `run`.
 */
export const useScenarioContext = (
    network: FixtureNetwork,
): ScenarioContext => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { signTransactions } = useLocalKeyTransactionSigner()
    const { createHdWalletAccount, createSingleKeyAccount } =
        useCreateAccount(scope)
    const { mutateAsync: restoreCloudBackup } =
        useRestoreCloudBackupMutation(scope)
    const { importAccounts } = useCloudBackupImport(scope)
    const { importContacts } = useCloudBackupContactImport()
    const resolveMnemonic = useResolveMnemonicForBackup(LEGACY_CHAIN_ID)
    const resolveHd = useResolveHdSeedForBackup(LEGACY_CHAIN_ID)

    const latest = useRef({
        signTransactions,
        createHdWalletAccount,
        createSingleKeyAccount,
        restoreCloudBackup,
        importAccounts,
        importContacts,
        resolveMnemonic,
        resolveHd,
    })
    latest.current = {
        signTransactions,
        createHdWalletAccount,
        createSingleKeyAccount,
        restoreCloudBackup,
        importAccounts,
        importContacts,
        resolveMnemonic,
        resolveHd,
    }

    return useMemo(
        (): ScenarioContext => ({
            network,
            signTransactions: (...args) =>
                latest.current.signTransactions(...args),
            createHdWalletAccount: (...args) =>
                latest.current.createHdWalletAccount(...args),
            createSingleKeyAccount: (...args) =>
                latest.current.createSingleKeyAccount(...args),
            restoreCloudBackup: variables =>
                latest.current.restoreCloudBackup(variables),
            backupSyncDeps: {
                importAccounts: (...args) =>
                    latest.current.importAccounts(...args),
                importContacts: (...args) =>
                    latest.current.importContacts(...args),
                resolveMnemonic: (...args) =>
                    latest.current.resolveMnemonic(...args),
                resolveHd: (...args) => latest.current.resolveHd(...args),
            },
            resetState: () => resetBenchState(network),
        }),
        [network],
    )
}
