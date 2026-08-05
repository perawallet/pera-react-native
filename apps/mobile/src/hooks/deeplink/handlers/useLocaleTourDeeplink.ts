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

import { useCallback } from 'react'

import { getLocaleTourRunner } from '@modules/locale-tour/registry'
import type { LocaleTourDeeplinkHandler } from '@modules/locale-tour/types'

/**
 * `step` drives one surface: an external screenshot driver owns the loop, so
 * a single surface can be re-checked without replaying the whole gallery
 * catalog. `run: 'all'` drives the whole tour behind this one dispatch (see
 * runTour.ts). `locale`/`step`/`run` are already validated at the parse
 * boundary (dev-locale-tour-parser.ts); `runTourStep` itself handles an
 * unknown step id by emitting an error marker and launching nothing, so this
 * handler doesn't duplicate that check.
 *
 * Reached through the registry rather than by importing the tour, so this file
 * never depends on the gallery catalog. Importing it either way — statically or
 * dynamically — closes a cycle back through useDeepLink; registry.ts explains
 * the loop. A missing runner means a non-dev bundle, where the parse boundary
 * has already rejected the URL anyway.
 */
export const useLocaleTourDeeplink = (): LocaleTourDeeplinkHandler =>
    useCallback(async ({ locale, step, run }) => {
        const runner = getLocaleTourRunner()
        if (!runner) return

        if (run === 'all') {
            await runner.runTour({ locale })
            return
        }

        if (!step) return

        await runner.runTourStep({ stepId: step, locale })
    }, [])
