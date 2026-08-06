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

import { describe, expect, it } from 'vitest'

import * as deeplinkHandlerStub from '@hooks/deeplink/handlers/useLocaleTourDeeplink.stub'
import * as parserStub from '@hooks/deeplink/dev-locale-tour-parser.stub'

import * as pseudoResourcesStub from '../../../i18n/pseudoResources.stub'
import * as overflowProbeStub from '../hooks/useOverflowProbe.stub'
import * as tourStub from '../index.stub'
import * as registerStub from '../register.stub'
import { getLocaleTourRunner } from '../registry'

// The only guard against a stub drifting from the module it replaces. Metro is
// the sole thing that ever resolves a `.stub.ts` — vitest and tsc both go
// through tsconfig paths and so always load the real module — which means
// nothing else in the suite would notice a stub that stopped type-checking as
// a substitute.
//
// Each binding below is annotated with `typeof import(...)` of the real module,
// which is what performs the assertion: assigning the stub to it fails to
// compile unless the stub satisfies every exported signature. It is a
// type-level reference, so the real module is never loaded (importing the tour
// barrel here would pull in the whole gallery catalog for no benefit), and the
// tests then call the stubs *through* those real signatures.

const tour: typeof import('../index') = tourStub
const overflowProbe: typeof import('../hooks/useOverflowProbe') =
    overflowProbeStub
const pseudoResources: typeof import('../../../i18n/pseudoResources') =
    pseudoResourcesStub
const parser: typeof import('@hooks/deeplink/dev-locale-tour-parser') =
    parserStub
const deeplinkHandler: typeof import('@hooks/deeplink/handlers/useLocaleTourDeeplink') =
    deeplinkHandlerStub
const register: typeof import('../register') = registerStub

describe('locale tour stubs', () => {
    // register.stub.ts having been imported above is the whole test: it is the
    // only module that ever registers a runner, so a non-dev bundle leaves the
    // registry empty and the deeplink handler with nothing to call.
    it('leave the registry empty, so the tour deeplink has no runner', () => {
        expect(register).toBeDefined()
        expect(getLocaleTourRunner()).toBeUndefined()
    })

    it('drive nothing: no steps, no tour deeplink, no pseudolocale resources', async () => {
        expect(tour.getTourSteps()).toEqual([])
        expect(
            await tour.runTourStep({ stepId: 'scr-home', locale: 'en-XA' }),
        ).toBe('unknown-step')
        expect(pseudoResources.getPseudoResources()).toEqual({})
        expect(
            parser.parseDevLocaleTourUri(
                'perawallet://app/dev/locale-tour?locale=en-XA&run=all',
            ),
        ).toBeNull()
        expect(
            parser.isDevLocaleTourDeeplink({
                type: 'DEV_LOCALE_TOUR',
                sourceUrl: '',
                locale: 'en-XA',
                step: 'scr-home',
            }),
        ).toBe(false)
    })

    it('resolve the deeplink handler to something that dispatches nothing', async () => {
        const handler = deeplinkHandler.useLocaleTourDeeplink()

        await expect(
            handler({ locale: 'en-XA', run: 'all' }),
        ).resolves.toBeUndefined()
    })

    it('attach no layout handlers and allocate nothing per call', () => {
        // PWText renders on every screen: a fresh object (or fresh closures)
        // per render would make the stubbed path more expensive than the
        // branch it replaced.
        const first = overflowProbe.useOverflowProbe({
            children: 'text',
            numberOfLines: 1,
        })
        const second = overflowProbe.useOverflowProbe({
            children: 'other text',
            numberOfLines: undefined,
        })

        expect(first).toBe(second)
        expect(first.onLayout).toBeUndefined()
        expect(first.onTextLayout).toBeUndefined()
    })
})
