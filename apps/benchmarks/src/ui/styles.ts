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

import { StyleSheet } from 'react-native'

// Plain colours: the bench is a tool screen with no theme to follow.
export const colors = {
    background: '#101114',
    surface: '#1c1e24',
    text: '#f2f3f5',
    muted: '#9aa0ab',
    accent: '#ffee55',
    good: '#4cc38a',
    bad: '#ff6369',
    neutral: '#9aa0ab',
}

export const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, paddingTop: 56 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    card: {
        backgroundColor: colors.surface,
        marginHorizontal: 16,
        marginVertical: 4,
        padding: 12,
        borderRadius: 8,
    },
    title: { color: colors.text, fontSize: 16, fontWeight: '600' },
    body: { color: colors.text, fontSize: 13 },
    muted: { color: colors.muted, fontSize: 12 },
    button: {
        backgroundColor: colors.accent,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 6,
    },
    buttonOff: { opacity: 0.4 },
    buttonText: { color: '#000', fontWeight: '600' },
    chip: {
        borderWidth: 1,
        borderColor: colors.muted,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
    },
    chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.text },
    chipTextOn: { color: '#000' },
    banner: { backgroundColor: colors.bad, padding: 8 },
    bannerText: { color: '#000', textAlign: 'center' },
})
