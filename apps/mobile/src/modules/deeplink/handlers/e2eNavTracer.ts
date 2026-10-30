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

import { AppState } from 'react-native'
import { File, Paths } from 'expo-file-system'

import { navigationRef } from '@routes/navigationRef'
import type { Optional } from '@perawallet/wallet-core-shared'

// Only useE2eFixtureDeeplink imports this, so it leaves the bundle with that
// module's stub: release builds carry no tracer.
export const NAV_TRACE_TAG = '[E2E-NAV]'

type TracedRoute = { key: string; path: string }
type RouteNode = {
    key: string
    name: string
    state?: StateNode
}
type StateNode = {
    type?: string
    index?: number
    routes: RouteNode[]
}

export type NavTraceEvent =
    | 'mount'
    | 'unmount'
    | 'focus'
    | 'blur'
    | 'double-open'
    | 'app'
    | 'snapshot'

// Release builds on iOS keep console.log out of the system log, so the trace is
// also mirrored to a file the harness pulls from the app's Documents folder.
const TRACE_FILE_LINES = 400
const traceLines: string[] = []
let seq = 0

const mirrorToFile = (line: string): void => {
    traceLines.push(line)
    if (traceLines.length > TRACE_FILE_LINES) traceLines.shift()
    try {
        const file = new File(Paths.document, 'e2e-nav.log')
        file.create({ overwrite: true })
        file.writeSync(traceLines.join('\n'))
    } catch {
        // The device log still carries the line; a missing file only loses the mirror.
    }
}

const emit = (event: NavTraceEvent, data: Record<string, unknown>): void => {
    seq += 1
    const line = `${NAV_TRACE_TAG} ${JSON.stringify({ event, seq, t: Date.now(), ...data })}`
    // eslint-disable-next-line no-console -- the device log is the channel the harness reads
    console.log(line)
    mirrorToFile(line)
}

export const flattenRoutes = (
    state: Optional<StateNode>,
    parent = '',
): TracedRoute[] =>
    (state?.routes ?? []).flatMap(route => {
        const path = parent ? `${parent}/${route.name}` : route.name
        return [{ key: route.key, path }, ...flattenRoutes(route.state, path)]
    })

export const focusedPath = (state: Optional<StateNode>): string => {
    const names: string[] = []
    let node = state
    while (node?.routes?.length) {
        const route = node.routes[node.index ?? node.routes.length - 1]
        names.push(route.name)
        node = route.state
    }
    return names.join('/')
}

/** Adjacent same-name routes in one stack: the same screen pushed twice. */
export const doubleOpens = (
    state: Optional<StateNode>,
    parent = '',
): string[] =>
    (state?.routes ?? []).flatMap((route, i, routes) => {
        const path = parent ? `${parent}/${route.name}` : route.name
        const repeated =
            state?.type === 'stack' &&
            i > 0 &&
            routes[i - 1].name === route.name
        return [
            ...(repeated ? [`${path}#${route.key}`] : []),
            ...doubleOpens(route.state, path),
        ]
    })

let mounted = new Map<string, string>()
let focused = ''
const reportedDoubleOpens = new Set<string>()
let started = false
let pendingSnapshot: Optional<string>

const onStateChange = (): void => {
    const state = navigationRef.getRootState() as Optional<StateNode>
    const next = new Map(
        flattenRoutes(state).map(route => [route.key, route.path]),
    )
    for (const [key, path] of mounted) {
        if (!next.has(key)) emit('unmount', { screen: path })
    }
    for (const [key, path] of next) {
        if (!mounted.has(key)) emit('mount', { screen: path })
    }
    mounted = next

    const nextFocused = focusedPath(state)
    if (nextFocused !== focused) {
        if (focused) emit('blur', { screen: focused })
        emit('focus', { screen: nextFocused })
        focused = nextFocused
    }

    if (pendingSnapshot) {
        traceSnapshot(pendingSnapshot)
        pendingSnapshot = undefined
    }

    for (const id of doubleOpens(state)) {
        if (reportedDoubleOpens.has(id)) continue
        reportedDoubleOpens.add(id)
        emit('double-open', { screen: id.split('#')[0] })
    }
}

/**
 * Logs every mounted screen once the navigation state next settles. Called just
 * before a fixture reset, so the line marks the reset as applied (the harness
 * waits on it) and anything listed outside TabBar is a leak.
 */
export const snapshotOnNextState = (label: string): void => {
    pendingSnapshot = label
}

/** Logs every mounted screen; anything outside TabBar after a fixture reset is a leak. */
export const traceSnapshot = (label: string): void => {
    emit('snapshot', { label, screens: [...mounted.values()] })
}

/**
 * Logs screen mount/unmount and focus/blur (the React Native counterparts of
 * onCreate/onDestroy and onResume/onPause), app foreground/background, and the
 * same screen pushed twice, so the harness can compare intended and actual flows.
 */
export const startNavTracer = (): void => {
    if (started) return
    started = true
    const attach = (): void => {
        // Test harnesses render this hook with a stand-in navigationRef.
        if (typeof navigationRef.addListener !== 'function') return
        if (!navigationRef.isReady()) {
            setTimeout(attach, 200)
            return
        }
        navigationRef.addListener('state', onStateChange)
        onStateChange()
    }
    attach()
    AppState.addEventListener?.('change', appState =>
        emit('app', { state: appState }),
    )
}
