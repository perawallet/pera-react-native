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
import { definePodsRootForExtension } from '../withPasskeyAutofillFixes'

type BuildSettings = Record<string, string>

const fakeProject = () => {
    const configs: Record<string, { buildSettings: BuildSettings } | string> = {
        APP_RELEASE: { buildSettings: {} },
        EXT_DEBUG: { buildSettings: {} },
        EXT_RELEASE: { buildSettings: {} },
    }
    return {
        configs,
        project: {
            pbxNativeTargetSection: () => ({
                APP: {
                    name: 'Pera7Staging',
                    buildConfigurationList: 'APP_LIST',
                },
                APP_comment: 'Pera7Staging',
                EXT: {
                    name: '"PasskeyAutofillCredentialProvider"',
                    buildConfigurationList: 'EXT_LIST',
                },
            }),
            pbxXCConfigurationList: () => ({
                APP_LIST: { buildConfigurations: [{ value: 'APP_RELEASE' }] },
                EXT_LIST: {
                    buildConfigurations: [
                        { value: 'EXT_DEBUG' },
                        { value: 'EXT_RELEASE' },
                    ],
                },
            }),
            pbxXCBuildConfigurationSection: () => configs,
        },
    }
}

const settings = (
    configs: ReturnType<typeof fakeProject>['configs'],
    key: string,
) => (configs[key] as { buildSettings: BuildSettings }).buildSettings

describe('definePodsRootForExtension', () => {
    // ccache's compiler path is built from PODS_ROOT, which only targets in
    // the Podfile get; without it the extension's compiler is /node_modules/….
    it('defines PODS_ROOT on every extension configuration and nowhere else', () => {
        const { project, configs } = fakeProject()

        definePodsRootForExtension(project as never)

        expect(settings(configs, 'EXT_DEBUG').PODS_ROOT).toBe(
            '"$(SRCROOT)/Pods"',
        )
        expect(settings(configs, 'EXT_RELEASE').PODS_ROOT).toBe(
            '"$(SRCROOT)/Pods"',
        )
        expect(settings(configs, 'APP_RELEASE').PODS_ROOT).toBeUndefined()
    })

    it('keeps a PODS_ROOT the extension already has', () => {
        const { project, configs } = fakeProject()
        settings(configs, 'EXT_DEBUG').PODS_ROOT = '"/custom/Pods"'

        definePodsRootForExtension(project as never)

        expect(settings(configs, 'EXT_DEBUG').PODS_ROOT).toBe('"/custom/Pods"')
    })
})
