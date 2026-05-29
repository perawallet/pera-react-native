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

/**
 * Test stub for `react-native-passkey`. The published module is a native
 * TurboModule (`NativePasskey`) that vitest's transformer can't load and that
 * has no meaning under jsdom. App.tsx → bootstrap/liquid-auth →
 * modules/connections/liquid-auth/credentialsMechanism imports `Passkey` from it, so it
 * enters the dependency graph as soon as the integration setup loads the app
 * bootstrap. Liquid Auth tests drive a mocked credential mechanism, so inert
 * static methods are enough. Matches the real named `Passkey` export (a class
 * with static methods).
 */

export class Passkey {
    static async get(): Promise<Record<string, unknown>> {
        return {}
    }

    static async create(): Promise<Record<string, unknown>> {
        return {}
    }

    static isSupported(): boolean {
        return true
    }
}
