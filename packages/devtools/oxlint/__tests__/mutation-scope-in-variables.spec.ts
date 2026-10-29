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
import { RuleTester } from 'oxlint/plugins-dev'
import {
    MUTATION_CALLBACKS,
    SCOPE_SOURCE_HOOK,
    mutationScopeInVariables,
} from '../rules/mutation-scope-in-variables.js'

RuleTester.describe = describe
RuleTester.it = it

const captured = (callback: string, name: string, hook: string) => ({
    messageId: 'captured',
    data: { callback, name, hook },
})

new RuleTester({
    languageOptions: { parserOptions: { lang: 'ts' } },
}).run('mutation-scope-in-variables', mutationScopeInVariables, {
    invalid: [
        {
            name: 'mutationFn reads a deployment from useWalletDeployment',
            code: `
                function useRemove() {
                    const deployment = useWalletDeployment()
                    return useMutation({
                        mutationFn: async () => remove(deployment),
                    })
                }`,
            errors: [
                captured('mutationFn', 'deployment', 'useWalletDeployment'),
            ],
        },
        {
            name: 'a method-shorthand callback is checked',
            code: `
                const useX = () => {
                    const scope = useSelectedScope(chainId)
                    return useMutation({
                        onSuccess() {
                            refresh(scope)
                        },
                    })
                }`,
            errors: [captured('onSuccess', 'scope', 'useSelectedScope')],
        },
        {
            name: 'a fallback on the source call still binds the source',
            code: `
                function useX() {
                    const deviceID = useDeploymentDeviceID(deployment) ?? ''
                    return useMutation({
                        onSettled: () => log(deviceID),
                    })
                }`,
            errors: [
                captured('onSettled', 'deviceID', 'useDeploymentDeviceID'),
            ],
        },
        {
            name: 'a type assertion on the source call still binds the source',
            code: `
                function useX() {
                    const scope = useSelectedScope() as ChainScope
                    return useMutation({ mutationFn: () => post(scope) })
                }`,
            errors: [captured('mutationFn', 'scope', 'useSelectedScope')],
        },
        {
            name: 'a destructured binding is tracked',
            code: `
                function useX(account) {
                    const { scope } = useSwapScope(account)
                    return useMutation({
                        onMutate: () => snapshot(scope),
                    })
                }`,
            errors: [captured('onMutate', 'scope', 'useSwapScope')],
        },
        {
            name: 'a read in a nested arrow inside the callback is reported',
            code: `
                function useX() {
                    const scope = useSelectedScope()
                    return useMutation({
                        onError: error => {
                            const report = () => track(scope, error)
                            report()
                        },
                    })
                }`,
            errors: [captured('onError', 'scope', 'useSelectedScope')],
        },
        {
            name: 'useNetwork is a source',
            code: `
                function useX() {
                    const network = useNetwork()
                    return useMutation({ mutationFn: () => post(network) })
                }`,
            errors: [captured('mutationFn', 'network', 'useNetwork')],
        },
        {
            name: 'useScopedDeviceID is a source',
            code: `
                function useX() {
                    const deviceId = useScopedDeviceID()
                    return useMutation({ mutationFn: () => post(deviceId) })
                }`,
            errors: [captured('mutationFn', 'deviceId', 'useScopedDeviceID')],
        },
        {
            name: 'useDeviceID is a source',
            code: `
                function useX() {
                    const deviceId = useDeviceID()
                    return useMutation({ mutationFn: () => post(deviceId) })
                }`,
            errors: [captured('mutationFn', 'deviceId', 'useDeviceID')],
        },
        {
            name: 'one report per binding per callback, however many reads',
            code: `
                function useX() {
                    const scope = useSelectedScope()
                    return useMutation({
                        mutationFn: () => {
                            prepare(scope)
                            send(scope)
                            return finish(scope)
                        },
                        onSuccess: () => refresh(scope),
                    })
                }`,
            errors: [
                captured('mutationFn', 'scope', 'useSelectedScope'),
                captured('onSuccess', 'scope', 'useSelectedScope'),
            ],
        },
        {
            name: 'useMutation type arguments do not hide the call',
            code: `
                function useX() {
                    const deployment = useWalletDeployment()
                    return useMutation<void, Error, Vars>({
                        mutationFn: async () => remove(deployment),
                    })
                }`,
            errors: [
                captured('mutationFn', 'deployment', 'useWalletDeployment'),
            ],
        },
    ],
    valid: [
        {
            name: 'the fixed shape: the callback parameter shadows the binding',
            code: `
                function useX() {
                    const scope = useSelectedScope()
                    const { mutateAsync } = useMutation({
                        mutationFn: ({ scope }: V) => post(scope),
                    })
                    return useCallback(
                        input => mutateAsync({ ...input, scope }),
                        [mutateAsync, scope],
                    )
                }`,
        },
        {
            name: 'a callback reads the value from its variables argument',
            code: `
                function useX() {
                    const deployment = useWalletDeployment()
                    return useMutation({
                        mutationFn: (variables: V) => post(variables.deployment),
                        onSettled: (_data, _error, variables) =>
                            invalidate(variables.deployment),
                    })
                }`,
        },
        {
            name: 'bindings from hooks that are not scope sources',
            code: `
                function useX() {
                    const queryClient = useQueryClient()
                    const lookup = useDeviceIdLookup()
                    const onSwitch = useOnDeploymentSwitch()
                    return useMutation({
                        mutationFn: () => run(queryClient, lookup, onSwitch),
                    })
                }`,
        },
        {
            name: 'a source binding in mutationKey or outside the options object',
            code: `
                function useX() {
                    const scope = useSelectedScope()
                    const key = ['k', scope]
                    return useMutation({
                        mutationKey: ['k', scope],
                        mutationFn: () => post(),
                    })
                }`,
        },
        {
            name: 'a callback passed by identifier is not followed',
            code: `
                function useX() {
                    const scope = useSelectedScope()
                    const onSuccess = () => refresh(scope)
                    return useMutation({ mutationFn: () => post(), onSuccess })
                }`,
        },
        {
            name: 'a hook parameter named scope is not a hook result',
            code: `
                function useX(scope: ChainScope) {
                    return useMutation({ mutationFn: () => post(scope) })
                }`,
        },
        {
            name: 'queries are not mutations',
            code: `
                function useX() {
                    const scope = useSelectedScope()
                    return useQuery({ queryKey: ['k'], queryFn: () => get(scope) })
                }`,
        },
        {
            name: 'a source binding that no callback reads',
            code: `
                function useX() {
                    const scope = useSelectedScope()
                    return { scope, ...useMutation({ mutationFn: () => post() }) }
                }`,
        },
    ],
})

describe('pera/mutation-scope-in-variables constants', () => {
    it('names every callback TanStack runs with the latest render options', () => {
        expect(MUTATION_CALLBACKS).toEqual([
            'mutationFn',
            'onMutate',
            'onSuccess',
            'onError',
            'onSettled',
        ])
    })

    it.each([
        'useSelectedScope',
        'useSelectedScopes',
        'useWalletDeployment',
        'useDeploymentDeviceID',
        'useSelectedNetworkId',
        'useSelectedChainMode',
        'useSwapScope',
        'useNetwork',
        'useScopedDeviceID',
        'useDeviceID',
    ])('matches the source hook %s', name => {
        expect(SCOPE_SOURCE_HOOK.test(name)).toBe(true)
    })

    it.each([
        'useDeviceIdLookup',
        'useOnDeploymentSwitch',
        'useNetworkStore',
        'useNetworkStatus',
        'useIsDarkMode',
    ])('rejects %s', name => {
        expect(SCOPE_SOURCE_HOOK.test(name)).toBe(false)
    })
})
