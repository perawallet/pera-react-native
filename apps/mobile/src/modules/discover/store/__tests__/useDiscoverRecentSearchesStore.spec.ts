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

import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    MAX_RECENT_SEARCHES,
    recentSearchKey,
    useDiscoverRecentSearchesStore,
    type RecentSearch,
} from '../useDiscoverRecentSearchesStore'

const urlItem = (url: string): RecentSearch => ({ kind: 'url', url })

describe('useDiscoverRecentSearchesStore', () => {
    beforeEach(() => {
        useDiscoverRecentSearchesStore.setState({ items: [] })
    })

    test('eleven pushes keep the newest ten, newest first', () => {
        const { push } = useDiscoverRecentSearchesStore.getState()
        for (let i = 0; i < 11; i++) push(urlItem(`https://a${i}.io`))
        const { items } = useDiscoverRecentSearchesStore.getState()
        expect(items).toHaveLength(MAX_RECENT_SEARCHES)
        expect(items[0]).toEqual(urlItem('https://a10.io'))
        expect(items[9]).toEqual(urlItem('https://a1.io'))
    })

    test('pushing an existing key moves it to the top without a duplicate', () => {
        const { push } = useDiscoverRecentSearchesStore.getState()
        push(urlItem('https://a.io'))
        push(urlItem('https://b.io'))
        push(urlItem('https://a.io'))
        expect(useDiscoverRecentSearchesStore.getState().items).toEqual([
            urlItem('https://a.io'),
            urlItem('https://b.io'),
        ])
    })

    test('urls that normalise equally share a key', () => {
        expect(recentSearchKey(urlItem('https://a.io/'))).toBe(
            recentSearchKey(urlItem('https://A.io')),
        )
        const { push } = useDiscoverRecentSearchesStore.getState()
        push(urlItem('https://a.io/'))
        push(urlItem('https://A.io'))
        expect(useDiscoverRecentSearchesStore.getState().items).toHaveLength(1)
    })

    test('keys differ by kind', () => {
        const dapp: RecentSearch = {
            kind: 'dapp',
            dapp: {
                url: 'https://a.io',
                name: 'A',
                logo: null,
                categories: [],
                chains: [],
            },
        }
        expect(recentSearchKey(dapp)).toBe('dapp:https://a.io')
        expect(recentSearchKey(urlItem('https://a.io'))).toBe(
            'url:https://a.io',
        )
        expect(recentSearchKey(urlItem('not a url'))).toBe('url:not a url')
    })

    test('remove drops only the matching item', () => {
        const { push, remove } = useDiscoverRecentSearchesStore.getState()
        push(urlItem('https://a.io'))
        push(urlItem('https://b.io'))
        remove(recentSearchKey(urlItem('https://a.io')))
        expect(useDiscoverRecentSearchesStore.getState().items).toEqual([
            urlItem('https://b.io'),
        ])
    })

    test('clear and resetState empty the list', () => {
        const store = useDiscoverRecentSearchesStore.getState()
        store.push(urlItem('https://a.io'))
        store.clear()
        expect(useDiscoverRecentSearchesStore.getState().items).toEqual([])
        store.push(urlItem('https://a.io'))
        store.resetState()
        expect(useDiscoverRecentSearchesStore.getState().items).toEqual([])
    })

    test('persists items only', async () => {
        useDiscoverRecentSearchesStore.getState().push(urlItem('https://a.io'))
        const raw = await getProvider().keyValueStorage.getItem(
            'discover-recent-searches-store',
        )
        const parsed = JSON.parse(raw as string)
        expect(Object.keys(parsed.state)).toEqual(['items'])
    })
})
