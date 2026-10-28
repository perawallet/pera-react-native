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

import { createContext, useContext, type ReactNode } from 'react'

export type AddressReuseGuard = {
    /** False when the user backed out of reusing the address. */
    confirmReuse: (address: string) => Promise<boolean>
}

const ALLOW_ALL: AddressReuseGuard = { confirmReuse: async () => true }

const AddressReuseGuardContext = createContext<AddressReuseGuard>(ALLOW_ALL)

export type AddressReuseGuardProviderProps = {
    guard: AddressReuseGuard
    children: ReactNode
}

export const AddressReuseGuardProvider = ({
    guard,
    children,
}: AddressReuseGuardProviderProps) => (
    <AddressReuseGuardContext.Provider value={guard}>
        {children}
    </AddressReuseGuardContext.Provider>
)

export const useAddressReuseGuard = (): AddressReuseGuard =>
    useContext(AddressReuseGuardContext)
