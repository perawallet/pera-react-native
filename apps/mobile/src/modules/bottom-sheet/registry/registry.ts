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

import type { ComponentType } from 'react'

import type { Optional } from '@perawallet/wallet-core-shared'
import type { BottomSheetRegistry } from '../types'

type RegisterBottomSheetOptions = {
    /**
     * Opens the sheet under this request id, so it dedupes against a sheet
     * opened directly with the same id instead of stacking a second instance.
     */
    id?: string
}

type RegistryEntry = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: ComponentType<any>
    id?: string
}

const entries = new Map<string, RegistryEntry>()

export const registerBottomSheet = <K extends keyof BottomSheetRegistry>(
    type: K,
    component: ComponentType<BottomSheetRegistry[K]>,
    options: RegisterBottomSheetOptions = {},
): void => {
    entries.set(type as string, { component, id: options.id })
}

export const getRegisteredBottomSheet = (
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Optional<ComponentType<any>> => {
    return entries.get(type)?.component
}

export const getRegisteredBottomSheetId = (type: string): Optional<string> => {
    return entries.get(type)?.id
}

/** Tests only — never call from production code. */
export const clearBottomSheetRegistryForTests = (): void => {
    entries.clear()
}
