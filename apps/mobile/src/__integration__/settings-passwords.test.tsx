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

// Passwords list -> add -> view -> delete, driven end to end against the real
// `@perawallet/wallet-core-passwords` storage layer and the in-memory keystore
// double (`@test-utils/algorand-keystore-test`) the passkeys flow tests share.
// The point is that a login the save path writes is the same record the list
// and view paths read back — a stub returning canned data would prove nothing.
//
// The screens themselves don't consult `routeCapabilities` (only the settings
// stack's route *registration* does), so mounting them directly through
// `renderWithNavigation` — the same approach `settings-passkeys.test.tsx`
// uses for a screen reached from a real registered route — reaches the flow
// without touching the shipped `passwordManager: false` default.
//
// PasswordListScreen's "add" button and AddPasswordScreen's "save" button
// both live in the navigation header (`useNavigationHeader`), which the
// integration test-navigator (`test-navigator.tsx`) never renders — its
// `setOptions` is a no-op and the mock Navigator only mounts the screen body.
// `contacts-crud.test.tsx`'s `EditContactHost` hits the same wall for
// `EditContactScreen`'s header "Done" button; its fix is the one applied
// here: call the real screen hook once and expose the same action through a
// body element, so the flow still runs the production save/navigate logic.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { PWButton, PWInput } from '@components/core'
import { PasswordListScreen, ViewPasswordScreen } from '@modules/passwords'
import { useAddPasswordScreen } from '@modules/passwords/screens/AddPasswordScreen'

const SLOW_TEST_TIMEOUT_MS = 30_000

const LOGIN = {
    domain: 'example.com',
    username: 'alice@example.com',
    password: 'correct horse battery staple',
}

// Exposes `handleAdd`'s target as a body button alongside the real screen, so
// the navigation the header button would trigger in production is reachable
// here too.
const PasswordListHost = () => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    return (
        <>
            <PasswordListScreen />
            <PWButton
                variant='primary'
                title='add'
                onPress={() => navigation.navigate('AddPassword')}
                testID='password_test_add_button'
            />
        </>
    )
}

// AddPasswordScreen's own body inputs can't be reused as-is: its Save action
// only exists inside the untestable header, and calling `useAddPasswordScreen`
// a second time here would create a second, disconnected state instance. So
// this drives the one real hook instance directly and renders just enough of
// the form to fill it and save.
const AddPasswordHost = () => {
    const {
        domain,
        username,
        password,
        setDomain,
        setUsername,
        setPassword,
        canSave,
        handleSave,
    } = useAddPasswordScreen()
    return (
        <>
            <PWInput
                testID='add_password_domain_input'
                value={domain}
                onChangeText={setDomain}
            />
            <PWInput
                testID='add_password_username_input'
                value={username}
                onChangeText={setUsername}
            />
            <PWInput
                testID='add_password_password_input'
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <PWButton
                variant='primary'
                title='save'
                isDisabled={!canSave}
                onPress={() => void handleSave()}
                testID='password_test_save_button'
            />
        </>
    )
}

const renderPasswordsFlow = () =>
    renderWithNavigation(PasswordListHost, 'PasswordList', {
        additionalScreens: [
            { name: 'AddPassword', component: AddPasswordHost },
            { name: 'ViewPassword', component: ViewPasswordScreen },
        ],
    })

describe('Flow: Settings → Passwords', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        // The default provider mock has no `replacePasswordCredentialIdentities`
        // (only the passkeys flows exercise it); `publishLoginIdentities`
        // already swallows a failing publish, but wiring it avoids a logged
        // error crowding the test output on every save/delete.
        ;(
            getProvider() as unknown as {
                passkeyAutofill: {
                    replacePasswordCredentialIdentities: (
                        ...args: unknown[]
                    ) => Promise<void>
                }
            }
        ).passkeyAutofill.replacePasswordCredentialIdentities = async () => {}
    })

    it(
        'saves a login, lists it, reveals its password, then deletes it back to empty',
        async () => {
            renderPasswordsFlow()

            await waitFor(() => {
                expect(
                    screen.getByTestId('password_list_empty_state'),
                ).toBeTruthy()
            })

            fireEvent.click(screen.getByTestId('password_test_add_button'))
            await waitFor(() => {
                expect(
                    screen.getByTestId('add_password_domain_input'),
                ).toBeTruthy()
            })

            fireEvent.change(screen.getByTestId('add_password_domain_input'), {
                target: { value: LOGIN.domain },
            })
            fireEvent.change(
                screen.getByTestId('add_password_username_input'),
                { target: { value: LOGIN.username } },
            )
            fireEvent.change(
                screen.getByTestId('add_password_password_input'),
                { target: { value: LOGIN.password } },
            )
            fireEvent.click(screen.getByTestId('password_test_save_button'))

            // Save navigates back to the list, which now shows the saved login.
            await waitFor(() => {
                expect(screen.getByText(LOGIN.domain)).toBeTruthy()
            })
            expect(
                screen.queryByTestId('password_list_empty_state'),
            ).toBeFalsy()

            const listItem = screen.getByTestId((testId: string) =>
                testId.startsWith('password_list_item_'),
            )
            // PWListItem is a test-only stub that surfaces its title/value via
            // props rather than text content — see PWListItem's own tests.
            expect(listItem.getAttribute('value')).toBe(LOGIN.username)
            fireEvent.click(listItem)

            await waitFor(() => {
                expect(screen.getByTestId('view_password_screen')).toBeTruthy()
            })
            expect(screen.getByTestId('view_password_domain').textContent).toBe(
                LOGIN.domain,
            )
            expect(
                screen.getByTestId('view_password_username').textContent,
            ).toBe(LOGIN.username)
            // Masked until revealed — the list query never carries plaintext.
            expect(
                screen.getByTestId('view_password_password').textContent,
            ).toBe('••••••••')

            fireEvent.click(screen.getByTestId('view_password_reveal_button'))
            await waitFor(() => {
                expect(
                    screen.getByTestId('view_password_password').textContent,
                ).toBe(LOGIN.password)
            })

            fireEvent.click(screen.getByTestId('view_password_delete_button'))
            await waitFor(() => {
                expect(
                    screen.getByTestId('view_password_delete_confirm_button'),
                ).toBeTruthy()
            })
            fireEvent.click(
                screen.getByTestId('view_password_delete_confirm_button'),
            )

            // Delete navigates back to the list, which is empty again.
            await waitFor(() => {
                expect(
                    screen.getByTestId('password_list_empty_state'),
                ).toBeTruthy()
            })
            expect(screen.queryByText(LOGIN.domain)).toBeFalsy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
