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

/**
 * Returns props for testing/automation. testID becomes the Android
 * resource-id and the iOS accessibilityIdentifier, so the ID never doubles as
 * the accessibilityLabel: screen readers would announce it instead of the
 * visible text. `accessible` keeps the element in the iOS tree Appium queries.
 */
export function getTestProps(id?: string, suffix?: string) {
    if (!id) {
        return {}
    }

    const suffixedID = suffix ? `${id}_${suffix}` : id

    return {
        testID: suffixedID,
        accessibilityIdentifier: suffixedID,
        accessible: true,
    }
}

/**
 * Screen/list wrappers: keep testID for automation without grouping
 * child elements on iOS.
 */
export function getContainerTestProps(id?: string) {
    if (!id) {
        return {}
    }

    return {
        testID: id,
        accessibilityIdentifier: id,
        accessible: false,
    }
}

/** Shared checkbox semantics for VoiceOver / TalkBack / Appium. */
export function getCheckboxAccessibilityProps(
    checked: boolean,
    disabled?: boolean,
) {
    return {
        accessibilityRole: 'checkbox' as const,
        accessibilityState: { checked, disabled: !!disabled },
    }
}

/**
 * Checkbox automation props for Appium on iOS and Android.
 */
export function getCheckboxTestProps(
    id: string,
    checked: boolean,
    disabled?: boolean,
) {
    return {
        ...getTestProps(id),
        ...getCheckboxAccessibilityProps(checked, disabled),
    }
}
