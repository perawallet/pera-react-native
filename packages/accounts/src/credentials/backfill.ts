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

import { SeedScheme } from '@perawallet/wallet-core-kms'
import {
    AccountTypes,
    type AccountCredential,
    type WalletAccount,
} from '../models'

export const credentialsFromLegacy = (
    account: WalletAccount,
): AccountCredential[] => {
    switch (account.type) {
        case AccountTypes.algo25:
            return [
                {
                    kind: 'local',
                    keyPairId: account.keyPairId,
                    provenance: SeedScheme.Algo25,
                },
            ]
        case AccountTypes.quantum:
            return [
                {
                    kind: 'local',
                    keyPairId: account.keyPairId,
                    provenance: SeedScheme.Quantum,
                },
            ]
        case AccountTypes.hdWallet: {
            const { account: index, change, keyIndex, derivationType } =
                account.hdWalletDetails
            return [
                {
                    kind: 'local',
                    keyPairId: account.keyPairId,
                    provenance: SeedScheme.Bip39,
                    hd: { account: index, change, keyIndex, derivationType },
                },
            ]
        }
        case AccountTypes.hardware: {
            const {
                manufacturer,
                deviceId,
                deviceName,
                transportType,
                accountIndex,
            } = account.hardwareDetails
            return [
                {
                    kind: 'hardware',
                    device: {
                        manufacturer,
                        deviceId,
                        deviceName,
                        transportType,
                    },
                    accountIndex,
                },
            ]
        }
        case AccountTypes.multisig: {
            const { threshold, addresses, version } = account.multisigDetails
            return [
                {
                    kind: 'multisig',
                    threshold,
                    members: [...addresses],
                    version,
                },
            ]
        }
        case AccountTypes.watch:
            return [{ kind: 'watch' }]
    }
}

/** Idempotent: an account that already carries credentials is returned as-is. */
export const withCredentials = <T extends WalletAccount>(account: T): T =>
    account.credentials
        ? account
        : { ...account, credentials: credentialsFromLegacy(account) }
