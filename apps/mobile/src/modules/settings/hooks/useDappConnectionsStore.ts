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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    DappPermissionStore,
    type DappPermission,
    type LocalStorageArea,
} from '@perawallet/wallet-extension-platform-chrome'

export const DAPP_CONNECTIONS_QUERY_KEY = ['dapp-connections'] as const

// apps/mobile's tsconfig doesn't declare the ambient `chrome` global (only
// extensions/platform-chrome does, via its own @types/chrome devDependency),
// so read it off globalThis with a narrow local shape instead of pulling
// @types/chrome into this program.
type ChromeGlobal = { storage?: { local?: LocalStorageArea } }

const getChromeLocalStorage = (): LocalStorageArea | null => {
    const chromeGlobal = (globalThis as unknown as { chrome?: ChromeGlobal })
        .chrome
    return chromeGlobal?.storage?.local ?? null
}

export type UseDappConnectionsStoreResult = {
    sites: DappPermission[]
    isLoading: boolean
    refetch: () => void
    revoke: (origin: string) => Promise<void>
}

export const useDappConnectionsStore = (): UseDappConnectionsStoreResult => {
    const queryClient = useQueryClient()

    // Native never mounts this screen (dappConnections capability is off
    // there), but stay safe if it's ever evaluated outside that gate.
    const store = useMemo(() => {
        const area = getChromeLocalStorage()
        return area ? new DappPermissionStore(area) : null
    }, [])

    const query = useQuery({
        queryKey: DAPP_CONNECTIONS_QUERY_KEY,
        queryFn: () => (store ? store.list() : Promise.resolve([])),
    })

    const revokeMutation = useMutation({
        mutationFn: (origin: string) =>
            store ? store.revoke(origin) : Promise.resolve(),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: DAPP_CONNECTIONS_QUERY_KEY,
            })
        },
    })

    const revoke = useCallback(
        (origin: string) => revokeMutation.mutateAsync(origin),
        [revokeMutation],
    )

    return {
        sites: query.data ?? [],
        isLoading: query.isLoading,
        refetch: () => void query.refetch(),
        revoke,
    }
}
