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

import { describe, expect, it } from 'vitest'
import { patchMainApplication } from '../withBluetoothEnable'

const IMPORT_LINE =
    'import com.algorand.perarn.perabluetooth.PeraBluetoothPackage'
const REGISTER_CALL = 'add(PeraBluetoothPackage())'

// Expo / RN template: getPackages() returns the autolinked list via `.apply { }`.
const TEMPLATE_APPLY_BLOCK = `package com.algorand.android

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication

class MainApplication : Application(), ReactApplication {
  override fun getPackages(): List<ReactPackage> =
      PackageList(this).packages.apply {
        // Packages that cannot be autolinked yet can be added manually here.
      }
}`

// Older shape: bare `PackageList(this).packages` with no apply block.
const TEMPLATE_BARE_PACKAGES = `package com.algorand.android

import android.app.Application
import com.facebook.react.PackageList

class MainApplication : Application() {
  override fun getPackages(): List<ReactPackage> = PackageList(this).packages
}`

describe('withBluetoothEnable patchMainApplication', () => {
    it('adds the import and registers the package in an existing apply block', () => {
        const result = patchMainApplication(TEMPLATE_APPLY_BLOCK)

        expect(result).toContain(IMPORT_LINE)
        expect(result).toContain(REGISTER_CALL)
    })

    it('wraps a bare PackageList(this).packages in an apply block with the registration', () => {
        const result = patchMainApplication(TEMPLATE_BARE_PACKAGES)

        expect(result).toContain(IMPORT_LINE)
        expect(result).toContain('PackageList(this).packages.apply {')
        expect(result).toContain(REGISTER_CALL)
    })

    it('is idempotent', () => {
        const once = patchMainApplication(TEMPLATE_APPLY_BLOCK)
        const twice = patchMainApplication(once)

        expect(twice).toBe(once)
    })

    it('throws if PackageList(this).packages cannot be found', () => {
        const malformed = `package com.algorand.android

import android.app.Application

class MainApplication : Application()`

        expect(() => patchMainApplication(malformed)).toThrow(
            /could not find `PackageList\(this\)\.packages`/,
        )
    })
})
