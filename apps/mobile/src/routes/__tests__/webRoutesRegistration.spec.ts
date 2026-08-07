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

// A capability flag that is ON while its root stack is NOT registered in
// WebMainRoutes is the worst failure shape available here: the UI renders the
// entry point, navigate() finds no such route, and the tap silently does
// nothing. That shipped three times (rekey rows, Create shared account, home
// banners) before anything caught it, because nothing asserted the two sides
// agree. Source-parsed rather than rendered: the navigator does not expose its
// screen list without mounting the whole app shell.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { routeCapabilities } from '../capabilities.web'

// Resolved from this file rather than a repo-root constant so a directory
// rename breaks the import, not the assertion (a hardcoded path that no longer
// exists would silently scan nothing and pass).
const webRoutesSource = readFileSync(
    join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        'WebMainRoutes.web.tsx',
    ),
    'utf8',
)

const registeredRoutes = new Set(
    [...webRoutesSource.matchAll(/name='([A-Za-z]+)'/g)].map(match => match[1]),
)

/** Root stacks each capability's UI entry points navigate to. */
const routesByCapability = {
    rekeyFlows: [
        'UndoRekey',
        'RekeyToLedger',
        'RekeyToStandard',
        'RekeyToShared',
        'RescanRekeyed',
    ],
    sharedAccounts: ['Multisig'],
    peraCard: ['PeraCard'],
    staking: ['Staking'],
} as const

describe('WebMainRoutes registration', () => {
    it('parses route names out of the web routes source', () => {
        // Guards the regex itself: a rename or formatting change that stopped
        // it matching would make every assertion below vacuously pass.
        expect(registeredRoutes.has('TabBar')).toBe(true)
        expect(registeredRoutes.size).toBeGreaterThan(5)
    })

    it.each(Object.entries(routesByCapability))(
        'registers every root stack that %s navigates to when the flag is on',
        (capability, routes) => {
            if (
                !routeCapabilities[capability as keyof typeof routeCapabilities]
            )
                return
            const missing = routes.filter(route => !registeredRoutes.has(route))
            expect(missing).toEqual([])
        },
    )

    // No capability flag gates this one: AccountScreen renders HomeBannersStrip
    // whenever a banner exists, on every platform, and both its handlers
    // navigate to this route.
    it('registers BannersCarouselModal, which has no capability gate', () => {
        expect(registeredRoutes.has('BannersCarouselModal')).toBe(true)
    })
})
