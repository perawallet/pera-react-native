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


import type { HardwareWalletTransport } from '../../types'
import type { LedgerAppDriver } from '../../app-driver'
import { ledgerAppDriverContractTests } from '../app-driver-contract'

let failure: unknown

const unused = () => Promise.reject(new Error('not exercised'))

const driver: LedgerAppDriver = {
    chainId: 'fixture',
    open: (transport, classifyError = error => error as never) => ({
        getAddress: unused,
        signTransaction: unused,
        signData: unused,
        getAppVersion: async () => {
            if (failure) throw classifyError(failure)
            return { major: 1, minor: 0, patch: 0 }
        },
        ...(transport.on
            ? {
                  onDisconnect: listener => {
                      transport.on?.('disconnect', listener)
                      return () => transport.off?.('disconnect', listener)
                  },
              }
            : {}),
        disconnect: () => transport.close(),
    }) satisfies HardwareWalletTransport,
}

ledgerAppDriverContractTests(() => driver, {
    arrangeExchangeFailure: error => {
        failure = error
    },
})
