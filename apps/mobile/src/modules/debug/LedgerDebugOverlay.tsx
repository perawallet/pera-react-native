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

// guardrails-ignore-file no-primitive-rn-components no-numeric-sizes no-typography-in-styles
// Temporary debug overlay; using primitives keeps the file isolated from
// the styling system so it can be deleted in a single revert once the
// issue is fixed.
import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLedgerDebugStore } from './ledgerDebugStore'

/**
 * [LEDGER-DEBUG] On-screen log overlay for debugging the SendFunds-modal
 * dismissal during Ledger signing. Tap the title bar to collapse/expand.
 * Tap "clear" to wipe entries. Temporary; remove once the root cause is
 * identified.
 */
export const LedgerDebugOverlay = () => {
    const entries = useLedgerDebugStore(s => s.entries)
    const visible = useLedgerDebugStore(s => s.visible)
    const setVisible = useLedgerDebugStore(s => s.setVisible)
    const clear = useLedgerDebugStore(s => s.clear)

    if (entries.length === 0 && !visible) return null

    return (
        <View
            style={styles.container}
            pointerEvents='box-none'
        >
            <View style={styles.panel}>
                <Pressable
                    onPress={() => setVisible(!visible)}
                    style={styles.header}
                >
                    <Text style={styles.headerText}>
                        LEDGER-DEBUG ({entries.length})
                    </Text>
                    <Pressable
                        onPress={clear}
                        hitSlop={8}
                    >
                        <Text style={styles.clearText}>clear</Text>
                    </Pressable>
                    <Text style={styles.toggleText}>
                        {visible ? 'hide' : 'show'}
                    </Text>
                </Pressable>
                {visible && (
                    <ScrollView
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                    >
                        {entries.map(e => (
                            <View
                                key={e.id}
                                style={styles.row}
                            >
                                <Text style={styles.rowTime}>{e.at}</Text>
                                <Text style={styles.rowLabel}>{e.label}</Text>
                                {!!e.detail && (
                                    <Text style={styles.rowDetail}>
                                        {e.detail}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        zIndex: 99999,
    },
    panel: {
        marginHorizontal: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: 6,
        maxHeight: 320,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.3)',
    },
    headerText: {
        color: '#FFD400',
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: '700',
    },
    clearText: {
        color: '#FF6B6B',
        fontFamily: 'monospace',
        fontSize: 11,
    },
    toggleText: {
        color: '#AAA',
        fontFamily: 'monospace',
        fontSize: 11,
    },
    list: {
        maxHeight: 280,
    },
    listContent: {
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    row: {
        marginBottom: 6,
    },
    rowTime: {
        color: '#888',
        fontFamily: 'monospace',
        fontSize: 10,
    },
    rowLabel: {
        color: '#FFD400',
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: '600',
    },
    rowDetail: {
        color: '#FFF',
        fontFamily: 'monospace',
        fontSize: 10,
    },
})
