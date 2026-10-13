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

import * as screensStub from '@modules/settings/routes/developer-gallery.stub'

import { routeCapabilities } from '../capabilities'
import { routeCapabilities as webCapabilities } from '../capabilities.web'
import * as flag from '../developer-gallery'
import * as flagStub from '../developer-gallery.stub'

// Only Metro ever resolves a `.stub.ts`, so these `typeof import(...)`
// annotations are what fail the type-check if a stub drifts from the module it
// replaces. They are type-level references: the real screens module (and the
// gallery catalog behind it) is never loaded here.
const stubbedFlag: typeof import('../developer-gallery') = flagStub
const stubbedScreens: typeof import('@modules/settings/routes/developer-gallery') =
    screensStub

describe('developer gallery gate', () => {
    it('is on in the real module, and both capability maps follow it', () => {
        expect(flag.isDeveloperGalleryIncluded).toBe(true)
        expect(routeCapabilities.developerGallery).toBe(true)
        expect(webCapabilities.developerGallery).toBe(true)
    })

    it('is off in both production stubs, so no route or entry point survives', () => {
        expect(stubbedFlag.isDeveloperGalleryIncluded).toBe(false)
        expect(stubbedScreens.developerGalleryScreens).toBeNull()
    })
})
