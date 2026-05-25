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

import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { mockContacts } from '@perawallet/wallet-core-dev-fixtures'

import { startApiReplay } from '../SettingsDeveloperGalleryScreen/devApiMock'

import type { ToolHandlers } from './index'

export const useGalleryToolHandlers = (): ToolHandlers => {
    const { addContact } = useContacts()
    const queryClient = useQueryClient()

    const onSeedContacts = useCallback(() => {
        mockContacts.forEach(contact => {
            try {
                addContact(contact)
            } catch {
                // already seeded — ignore duplicate-address errors
            }
        })
    }, [addContact])

    const onReplayApi = useCallback(() => {
        void startApiReplay().then(() => queryClient.invalidateQueries())
    }, [queryClient])

    return useMemo(
        () => ({ onSeedContacts, onReplayApi }),
        [onSeedContacts, onReplayApi],
    )
}
