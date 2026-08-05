#!/usr/bin/env node
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

// Drives the locale tour (runTour.ts) on a booted iOS Simulator and turns its
// marker stream into screenshots, overflow JSON, and a report.md.
//
// `xcrun simctl openurl` raises an OS "Open in Pera?" confirmation on every
// call, verified cold and with the app frontmost on iOS 26.2 — 190 per-step
// deeplinks would mean 190 taps. So this fires exactly one deeplink
// (`run=all`) and only observes afterward.
//
// Run: pnpm --filter mobile locale-tour --locale en-XA --out ./locale-shots

import { execFileSync } from 'node:child_process'
import {
    closeSync,
    existsSync,
    fstatSync,
    mkdirSync,
    openSync,
    readSync,
    writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const BUNDLE_ID = 'com.algorandllc.perarn.staging'
const DEEPLINK_BASE = 'perawallet://app/dev/locale-tour'
const DEFAULT_METRO_URL = 'http://localhost:8081'
// Expo's dev server writes structured JSONL events here — one file per CLI
// subcommand (`start`, `run:ios`, ...), always named after the subcommand,
// regardless of which one launched it. `metro:client_log` events carry the
// app's console.* calls verbatim in a `data` array, which is where the tour's
// markers land. Confirmed empirically against a live Metro instance this
// script does not own.
const DEFAULT_METRO_LOG = join(mobileRoot, '.expo/dev/logs/start.log')
const DEFAULT_OUT_DIR = join(mobileRoot, 'locale-shots')

const BEGIN_MARKER = 'LOCALE_TOUR_BEGIN'
const SHOT_MARKER = 'LOCALE_TOUR_SHOT'
const ERR_MARKER = 'LOCALE_TOUR_ERR'
const OVERFLOW_MARKER = 'LOCALE_TOUR_OVERFLOW'
const DONE_MARKER = 'LOCALE_TOUR_DONE'

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
// If nothing has landed in this long after BEGIN — or, before BEGIN, this
// long after firing the deeplink — the run is stuck (crashed app, wedged
// navigation, or a swallowed deeplink) rather than merely slow — stop and
// report what we have instead of burning the whole overall timeout in
// silence.
const STALL_TIMEOUT_MS = 30 * 1000
// A local file read, so cheap to poll tightly — the floor on detecting a
// marker is this, not the other way around.
const POLL_INTERVAL_MS = 25
// Time for the "Open in Pera?" dialog to actually appear before we try to
// dismiss it — dismissing too early is a no-op key press into empty air.
const DIALOG_APPEAR_DELAY_MS = 700

// Mirrors of app-side constants this Node process cannot import directly
// (runTour.ts/runTourStep.ts are TypeScript, compiled into the RN bundle,
// not this script's module graph) — keep these two, and NAVIGATION_LOST_TEXT
// below, in sync with their source of truth by hand.
const APP_CAPTURE_HOLD_MS = 700 // CAPTURE_HOLD_MS in src/routes/localeTour/runTour.ts
const APP_SETTLE_TIMEOUT_MS = 5000 // SETTLE_TIMEOUT_MS in src/routes/localeTour/runTourStep.ts
// NAVIGATION_LOST_REASON in src/routes/localeTour/runTour.ts — the app emits
// this exact ERR reason once it gives up after 3 consecutive
// navigation-not-ready outcomes, so the driver can report the cascade as one
// event instead of a wall of unrelated-looking ids.
const NAVIGATION_LOST_TEXT = 'navigation lost — remaining steps unreliable'

class PreconditionError extends Error {}

const fail = message => {
    console.error(`\n[locale-tour] ${message}\n`)
    process.exit(1)
}

const runCommand = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' })

// --- CLI ---------------------------------------------------------------

const parseCliArgs = () => {
    const { values } = parseArgs({
        options: {
            locale: { type: 'string' },
            out: { type: 'string', default: DEFAULT_OUT_DIR },
            'metro-url': { type: 'string', default: DEFAULT_METRO_URL },
            'metro-log': { type: 'string', default: DEFAULT_METRO_LOG },
            'timeout-ms': {
                type: 'string',
                default: String(DEFAULT_TIMEOUT_MS),
            },
        },
    })

    if (!values.locale) {
        fail(
            'Missing required --locale.\n' +
                '  Usage:\n' +
                '    pnpm --filter mobile locale-tour --locale en-XA --out ./locale-shots',
        )
    }

    return {
        locale: values.locale,
        // Resolved against process.cwd() here, once, rather than left as a
        // raw string threaded through mkdirSync/writeFileSync/execFileSync —
        // those all resolve relative paths against cwd too, so this doesn't
        // change behavior, but it makes the base explicit instead of
        // implicit, and lets main() log the real absolute destination before
        // anything is written. `pnpm --filter mobile locale-tour` runs with
        // cwd = apps/mobile (pnpm's per-package convention), so a relative
        // `--out` is relative to apps/mobile, NOT the repo root — passing
        // e.g. `./apps/mobile/locale-shots` from that context double-joins
        // into apps/mobile/apps/mobile/locale-shots. Pass an absolute path
        // if invoking this script from anywhere else.
        outDir: resolve(values.out),
        metroUrl: values['metro-url'],
        metroLogPath: values['metro-log'],
        timeoutMs: Number(values['timeout-ms']),
    }
}

// --- Preconditions -------------------------------------------------------
// Each of these throws PreconditionError with the exact remediation command,
// never a bare "failed" — a driver whose failures are confusing is worse
// than no driver, because the tour gets blamed instead of the setup.

const findBootedDevice = () => {
    let stdout
    try {
        stdout = runCommand('xcrun', [
            'simctl',
            'list',
            'devices',
            'booted',
            '-j',
        ])
    } catch (error) {
        throw new PreconditionError(
            `Could not query simctl (${error.message}). Is Xcode installed?`,
        )
    }
    const { devices } = JSON.parse(stdout)
    const booted = Object.values(devices)
        .flat()
        .find(device => device.state === 'Booted')

    if (!booted) {
        throw new PreconditionError(
            'No booted iOS Simulator found.\n' +
                '  Boot one first, e.g.:\n' +
                '    xcrun simctl boot "iPhone 16 Pro Max" && open -a Simulator',
        )
    }
    return booted
}

const checkMetroReachable = metroUrl => {
    let body = ''
    try {
        body = runCommand('curl', ['-s', `${metroUrl}/status`])
    } catch {
        // curl itself failing (connection refused) is the same failure as a
        // wrong response body — both mean "Metro isn't there".
    }
    if (body.trim() !== 'packager-status:running') {
        throw new PreconditionError(
            `Metro is not reachable at ${metroUrl}/status.\n` +
                '  Start it from the mobile package:\n' +
                '    pnpm --filter mobile start',
        )
    }
}

const checkAppInstalled = udid => {
    try {
        runCommand('xcrun', ['simctl', 'get_app_container', udid, BUNDLE_ID])
    } catch {
        throw new PreconditionError(
            `${BUNDLE_ID} is not installed on the booted simulator.\n` +
                '  Build and install the dev client:\n' +
                '    pnpm --filter mobile ios',
        )
    }
}

// "Connected to Metro" is the closest verifiable proxy for "past the splash"
// available from outside the app: a dev-client cold launch sits on the
// launcher screen with no socket open to Metro at all, while a bundle that
// has loaded keeps several long-lived connections open to it. This cannot
// distinguish "connected but still on an early screen" from "connected and
// idle at Home" — that's why the message below says so rather than
// implying certainty.
const checkAppConnectedToMetro = udid => {
    let launchctlOutput
    try {
        launchctlOutput = runCommand('xcrun', [
            'simctl',
            'spawn',
            udid,
            'launchctl',
            'list',
        ])
    } catch (error) {
        throw new PreconditionError(
            `Could not inspect running processes on the simulator: ${error.message}`,
        )
    }

    const processLine = launchctlOutput
        .split('\n')
        .find(line => line.includes(BUNDLE_ID))
    if (!processLine) {
        throw new PreconditionError(
            `${BUNDLE_ID} is not running on the simulator.\n` +
                '  Launch it, wait for it to connect to Metro and land past the splash\n' +
                '  screen, then re-run this script:\n' +
                `    xcrun simctl launch ${udid} ${BUNDLE_ID}`,
        )
    }

    const pid = processLine.trim().split(/\s+/)[0]
    let lsofOutput = ''
    if (pid !== '-') {
        try {
            lsofOutput = runCommand('lsof', ['-a', '-p', pid, '-i', ':8081'])
        } catch {
            // lsof exits non-zero when the process has no matching sockets —
            // that is the "not connected" case we're checking for, not an error.
        }
    }

    if (!lsofOutput.includes('ESTABLISHED')) {
        throw new PreconditionError(
            `${BUNDLE_ID} is running but has no active connection to Metro on port 8081.\n` +
                '  This is an Expo dev client: a cold launch lands on the dev-client\n' +
                '  launcher, which eats the tour deeplink instead of forwarding it to the\n' +
                '  app. Open the app on the simulator, wait for it to load past the splash\n' +
                '  screen, then re-run this script.',
        )
    }
}

// --- Metro log tail --------------------------------------------------------

const openTail = path => {
    const fd = openSync(path, 'r')
    const { size } = fstatSync(fd)
    // Start at end-of-file, not 0: a long-running Metro instance's log carries
    // markers from every earlier manual/tour run, and replaying those as if
    // they belonged to this run would misreport the reconciliation.
    return {
        fd,
        offset: size,
        buffer: '',
        // A raw chunk.toString('utf8') would corrupt any multibyte character
        // split across a poll boundary — pseudolocale text (en-XA) is
        // heavily non-ASCII, so this is not a corner case here. StringDecoder
        // holds back an incomplete trailing sequence until the next chunk
        // completes it.
        decoder: new StringDecoder('utf8'),
    }
}

const readNewLines = tail => {
    const { size } = fstatSync(tail.fd)
    if (size <= tail.offset) return []
    const length = size - tail.offset
    const chunk = Buffer.alloc(length)
    readSync(tail.fd, chunk, 0, length, tail.offset)
    tail.offset = size
    tail.buffer += tail.decoder.write(chunk)
    const lines = tail.buffer.split('\n')
    tail.buffer = lines.pop() ?? ''
    return lines.filter(line => line.length > 0)
}

// Each JSONL line is one Metro event; `console.log` calls from the app arrive
// as `metro:client_log` events with `data` holding the logged arguments. The
// tour only ever logs a single string per call, but this scans every string
// argument rather than assuming `data[0]`, so a future multi-arg log doesn't
// silently stop matching.
const extractMarkers = jsonLine => {
    let event
    try {
        event = JSON.parse(jsonLine)
    } catch {
        return []
    }
    if (event._e !== 'metro:client_log' || !Array.isArray(event.data)) return []
    return event.data
        .filter(
            item => typeof item === 'string' && item.startsWith('LOCALE_TOUR_'),
        )
        .map(text => ({ text, timestamp: event._t }))
}

// --- Dialog dismissal --------------------------------------------------

const dismissConfirmationDialog = () => {
    try {
        execFileSync('osascript', [
            '-e',
            'tell application "Simulator" to activate',
            '-e',
            'delay 0.3',
            '-e',
            'tell application "System Events" to key code 36',
        ])
    } catch (error) {
        console.warn(
            '\n[locale-tour] Could not auto-dismiss the "Open in Pera?" dialog ' +
                `(${String(error.stderr ?? error.message).trim()}).\n` +
                '  This requires a macOS Accessibility grant for the terminal running\n' +
                '  this script (System Settings > Privacy & Security > Accessibility).\n' +
                '  Grant it and re-run, or tap "Open" on the Simulator now by hand —\n' +
                '  the capture loop below will keep waiting for it.\n',
        )
    }
}

// --- Capture loop --------------------------------------------------------

const captureRun = ({ tail, stepDir, udid, timeoutMs }) => {
    const shots = []
    const errors = []
    const overflowSteps = []
    const captureFailures = []
    // Set once the app reports it gave up after 3 consecutive
    // navigation-not-ready outcomes (see NAVIGATION_LOST_TEXT) — lets the
    // report surface "navigation died at step N" as one event instead of
    // whatever tail of errors followed it.
    let navigationLost = null
    let expectedCount = null
    let done = false
    let lastMarkerAt = Date.now()
    // Anchors step-to-step wall time to BEGIN, then to each step's own
    // completion — OVERFLOW always arrives immediately before the SHOT for
    // the same step, so only SHOT/ERR (one per step) advance this anchor.
    let lastStepCompletedAt = null
    const startedAt = Date.now()

    const finishStep = timestamp => {
        const deltaMs =
            lastStepCompletedAt === null
                ? null
                : timestamp - lastStepCompletedAt
        lastStepCompletedAt = timestamp
        return deltaMs
    }

    return new Promise(resolve => {
        const tick = async () => {
            while (!done) {
                const elapsed = Date.now() - startedAt
                if (elapsed > timeoutMs) {
                    console.error(
                        `[locale-tour] overall timeout (${timeoutMs}ms) reached before DONE`,
                    )
                    break
                }
                if (Date.now() - lastMarkerAt > STALL_TIMEOUT_MS) {
                    // Before BEGIN, this catches a swallowed deeplink (wrong
                    // scheme, cold dev-client launcher eating it) instead of
                    // silently burning the full overall timeout waiting for
                    // a marker that was never going to arrive.
                    console.error(
                        expectedCount === null
                            ? `[locale-tour] no BEGIN marker received within ${STALL_TIMEOUT_MS}ms of firing the deeplink — it may have been swallowed rather than merely slow`
                            : `[locale-tour] no new marker for ${STALL_TIMEOUT_MS}ms — assuming the run stalled`,
                    )
                    break
                }

                const lines = readNewLines(tail)
                if (lines.length === 0) {
                    await sleep(POLL_INTERVAL_MS)
                    continue
                }

                for (const line of lines) {
                    for (const marker of extractMarkers(line)) {
                        lastMarkerAt = Date.now()
                        const parts = marker.text.split('|')
                        const kind = parts[0]

                        if (kind === BEGIN_MARKER) {
                            expectedCount = Number(parts[1])
                            lastStepCompletedAt = marker.timestamp
                            console.log(
                                `[locale-tour] BEGIN: ${parts[1]} steps, locale=${parts[2]}`,
                            )
                            continue
                        }
                        if (kind === DONE_MARKER) {
                            done = true
                            console.log('[locale-tour] DONE')
                            break
                        }
                        if (kind === SHOT_MARKER) {
                            const stepId = parts[1]
                            const deltaMs = finishStep(marker.timestamp)
                            const pngPath = join(stepDir, `${stepId}.png`)
                            try {
                                execFileSync('xcrun', [
                                    'simctl',
                                    'io',
                                    udid,
                                    'screenshot',
                                    pngPath,
                                ])
                                shots.push({ stepId, deltaMs })
                            } catch (error) {
                                captureFailures.push({
                                    stepId,
                                    reason: error.message,
                                })
                            }
                            continue
                        }
                        if (kind === ERR_MARKER) {
                            const stepId = parts[1]
                            const reason = parts.slice(2).join('|')
                            const deltaMs = finishStep(marker.timestamp)
                            errors.push({ stepId, reason, deltaMs })
                            if (reason === NAVIGATION_LOST_TEXT) {
                                const stepNumber = shots.length + errors.length
                                navigationLost = { stepId, stepNumber }
                                console.error(
                                    `[locale-tour] navigation died at step ${stepNumber} (${stepId}) — remaining steps unreliable`,
                                )
                            }
                            continue
                        }
                        if (kind === OVERFLOW_MARKER) {
                            const stepId = parts[1]
                            const json = parts.slice(2).join('|')
                            writeFileSync(join(stepDir, `${stepId}.json`), json)
                            overflowSteps.push({ stepId, json })
                            continue
                        }
                    }
                    if (done) break
                }
            }

            resolve({
                expectedCount,
                shots,
                errors,
                overflowSteps,
                captureFailures,
                navigationLost,
                done,
            })
        }
        // `tick` resolves the enclosing promise itself and swallows per-step
        // failures, so there is nothing here to await or catch.
        void tick()
    })
}

// --- Report ----------------------------------------------------------------

const percentile = (sortedValues, p) => {
    if (sortedValues.length === 0) return null
    const index = Math.min(
        sortedValues.length - 1,
        Math.floor(p * sortedValues.length),
    )
    return sortedValues[index]
}

// Includes errored steps deliberately: a step that hit the settle/mount
// timeout IS the timeout-bound population this section exists to surface —
// excluding it would hide exactly the steps most likely to explain a slow
// or stuck run.
const renderTimingSection = (shots, errors) => {
    const deltas = [...shots, ...errors]
        .map(step => step.deltaMs)
        .filter(value => typeof value === 'number')
        .sort((a, b) => a - b)

    if (deltas.length === 0) {
        return '## Timing\n\nNo per-step timing data (fewer than two completed steps).\n'
    }

    const min = deltas[0]
    const max = deltas[deltas.length - 1]
    const p50 = percentile(deltas, 0.5)
    const p95 = percentile(deltas, 0.95)
    // Just under the app's real settle timeout, not an arbitrary round
    // number — a step landing this close to it almost certainly hit the
    // timeout path rather than InteractionManager resolving on its own.
    const timeoutThreshold = APP_SETTLE_TIMEOUT_MS - 100
    const overTimeout = deltas.filter(value => value >= timeoutThreshold).length

    return (
        '## Timing\n\n' +
        "Wall time between one step's SHOT/ERR and the next, from Metro's own\n" +
        'event timestamps (not driver-measured, so screenshot/IPC overhead is not\n' +
        'included). This is a proxy for total step latency, not a direct read of\n' +
        `the settle timer — the app never marks whether a step's ${APP_SETTLE_TIMEOUT_MS}ms\n` +
        'timeout (SETTLE_TIMEOUT_MS) actually fired vs. `InteractionManager`\n' +
        'resolving early. Includes both captured and errored steps. These are\n' +
        'the same Metro log timestamps the "PNG attribution" section above\n' +
        'shows do not reliably reflect app-side timing — read the figures\n' +
        'below as directional, not measured.\n\n' +
        `- min: ${min}ms\n` +
        `- p50: ${p50}ms\n` +
        `- p95: ${p95}ms\n` +
        `- max: ${max}ms\n` +
        `- steps at/above ${timeoutThreshold}ms (likely settle-timeout-bound): ${overTimeout} / ${deltas.length}\n`
    )
}

const renderReport = ({
    locale,
    device,
    stepDir,
    expectedCount,
    shots,
    errors,
    overflowSteps,
    captureFailures,
    navigationLost,
    done,
}) => {
    const capturedCount = shots.length
    const erroredCount = errors.length
    const missingCount =
        expectedCount === null
            ? null
            : expectedCount - capturedCount - erroredCount
    // "Reconciled", not "clean": every expected step is accounted for
    // (SHOT, ERR, or explicitly missing) with no driver-side capture
    // failures, AND there were zero errors. Folding erroredCount in here is
    // deliberate — a run with 44 errors previously still reported "Clean
    // run: Yes" as long as they reconciled against BEGIN, which reads as
    // "nothing wrong" when 44 surfaces plainly failed.
    const reconciled =
        done &&
        missingCount === 0 &&
        captureFailures.length === 0 &&
        erroredCount === 0

    const lines = []
    lines.push(`# Locale tour report`)
    lines.push('')
    lines.push(`- locale: ${locale}`)
    lines.push(`- device: ${device.name} (${device.udid})`)
    lines.push(`- output: ${stepDir}`)
    // Leads with the ratio, not the bare SHOT count — "146 captured" alone
    // reads as success; "146 / 190" makes the shortfall visible on line one.
    lines.push(
        `- captures / expected: ${capturedCount} / ${expectedCount ?? 'never received'}`,
    )
    lines.push(`- errored (ERR): ${erroredCount}`)
    lines.push(`- driver-side screenshot failures: ${captureFailures.length}`)
    lines.push(`- DONE received: ${done}`)
    lines.push('')

    if (navigationLost) {
        lines.push(
            `**Navigation died at step ${navigationLost.stepNumber} ` +
                `(${navigationLost.stepId}) — the app gave up after 3 ` +
                'consecutive navigation-not-ready outcomes and stopped the ' +
                'run rather than continuing. This is one crash, not ' +
                'independent per-step failures — see "Errors" below for the ' +
                'few steps immediately before it, which failed as a direct ' +
                'consequence.**',
        )
        lines.push('')
    }
    if (!done) {
        lines.push(
            '**The run did not finish — it was stopped by a stall or overall ' +
                "timeout, not by the tour's own DONE marker. Everything below is a " +
                'partial result.**',
        )
        lines.push('')
    }
    if (missingCount !== null && missingCount !== 0) {
        lines.push(
            `**${missingCount} step(s) were never observed at all** (neither SHOT ` +
                'nor ERR) — skipped, or the run stopped before reaching them.',
        )
        lines.push('')
    }
    if (captureFailures.length > 0) {
        lines.push(
            `**${captureFailures.length} step(s) settled successfully in-app but ` +
                'the driver failed to screenshot them** — see "Capture failures" below.',
        )
        lines.push('')
    }

    lines.push('## Flagged steps (overflow detected)')
    lines.push('')
    if (overflowSteps.length === 0) {
        lines.push('None reported.')
    } else {
        for (const { stepId, json } of overflowSteps) {
            lines.push(`### ${stepId}`)
            lines.push('')
            lines.push('```json')
            lines.push(json)
            lines.push('```')
            lines.push('')
        }
    }
    lines.push('')

    lines.push('## Errors')
    lines.push('')
    if (errors.length === 0) {
        lines.push('None.')
    } else {
        const byReason = new Map()
        for (const { stepId, reason } of errors) {
            if (!byReason.has(reason)) byReason.set(reason, [])
            byReason.get(reason).push(stepId)
        }
        for (const [reason, stepIds] of byReason) {
            lines.push(
                `- **${reason}** (${stepIds.length}): ${stepIds.join(', ')}`,
            )
        }
    }
    lines.push('')

    if (captureFailures.length > 0) {
        lines.push('## Capture failures')
        lines.push('')
        for (const { stepId, reason } of captureFailures) {
            lines.push(`- ${stepId}: ${reason}`)
        }
        lines.push('')
    }

    lines.push('## PNG attribution')
    lines.push('')
    lines.push(
        'This driver does not verify that a given PNG actually shows the ' +
            'step it is filed under. The app holds each surface on screen for ' +
            `${APP_CAPTURE_HOLD_MS}ms (CAPTURE_HOLD_MS) after emitting a ` +
            "step's marker, specifically to give the external " +
            '`xcrun simctl io screenshot` command room to finish before the ' +
            'app advances, but there is no return channel confirming which ' +
            'screen a completed screenshot actually captured. An earlier ' +
            'version of this report compared Metro log timestamps against a ' +
            'risk threshold and called that "verified", which was false: ' +
            'those timestamps do not reliably reflect app-side timing (one ' +
            `observed gap was 297ms, below the app's own ${APP_CAPTURE_HOLD_MS}ms ` +
            'floor), so a heuristic built on them could not actually detect ' +
            'misattribution. Open a sample of PNGs by hand to sanity-check ' +
            'them. This does not affect the overflow JSON above, which the ' +
            'app writes in-process, before the SHOT marker, independent of ' +
            'the screenshot step.',
    )
    lines.push('')

    lines.push(renderTimingSection(shots, errors))
    lines.push('')

    lines.push('## Reconciled')
    lines.push('')
    lines.push(
        reconciled
            ? 'Yes — captured + errored reconciles against BEGIN, no capture failures, no errors.'
            : 'No — see the callouts above.',
    )
    lines.push('')

    return { markdown: lines.join('\n'), reconciled }
}

// --- Main ------------------------------------------------------------------

const main = async () => {
    const { locale, outDir, metroUrl, metroLogPath, timeoutMs } = parseCliArgs()

    let device
    try {
        device = findBootedDevice()
        checkMetroReachable(metroUrl)
        checkAppInstalled(device.udid)
        checkAppConnectedToMetro(device.udid)
    } catch (error) {
        if (error instanceof PreconditionError) fail(error.message)
        throw error
    }

    if (!existsSync(metroLogPath)) {
        fail(
            `Metro's JSONL log was not found at ${metroLogPath}.\n` +
                '  This driver reads console.log output from the dev-server log file\n' +
                '  that `expo start`/`expo run:ios` writes under .expo/dev/logs/ — it\n' +
                '  does not own the Metro process, so it cannot run without that file.\n' +
                '  If Metro was started a different way, pass --metro-log <path>.',
        )
    }

    const stepDir = join(outDir, device.name.replace(/\//g, '-'), locale)
    mkdirSync(stepDir, { recursive: true })
    // Printed as the resolved absolute path (see parseCliArgs), not the raw
    // --out string, specifically so a double-joined or otherwise
    // unintended destination is visible before the run writes anything.
    console.log(`[locale-tour] output directory: ${stepDir}`)

    const tail = openTail(metroLogPath)

    console.log(
        `[locale-tour] firing deeplink for locale=${locale} on ${device.name} (${device.udid})`,
    )
    runCommand('xcrun', [
        'simctl',
        'openurl',
        device.udid,
        `${DEEPLINK_BASE}?locale=${locale}&run=all`,
    ])

    await sleep(DIALOG_APPEAR_DELAY_MS)
    dismissConfirmationDialog()

    const result = await captureRun({
        tail,
        stepDir,
        udid: device.udid,
        timeoutMs,
    })
    closeSync(tail.fd)

    // Fail here rather than rendering a report. A stubbed bundle makes the tour
    // deeplink unrecognized, so the app never emits BEGIN and every count is
    // zero — and a report full of zeros with a non-zero exit code is exactly
    // the shape someone skims as "it ran, nothing to see".
    if (result.expectedCount === null) {
        fail(
            'The app never acknowledged the tour deeplink (no BEGIN marker).\n' +
                '  The most likely cause is a bundle with the tour stubbed out: it only\n' +
                '  resolves to the real modules when NODE_ENV=development, which Expo CLI\n' +
                '  sets for `expo start`. Check Metro\'s startup line:\n' +
                '    [metro] locale tour: enabled   <- good\n' +
                '    [metro] locale tour: stubbed   <- the deeplink cannot work\n' +
                '  If it says stubbed, restart Metro with `pnpm --filter mobile start`.\n' +
                '  Otherwise the dev-client launcher likely ate the deeplink — see the\n' +
                '  "Locale Tour" section of docs/TESTING.md.',
        )
    }

    const { markdown, reconciled } = renderReport({
        locale,
        device,
        stepDir,
        ...result,
    })
    const reportPath = join(outDir, 'report.md')
    writeFileSync(reportPath, markdown)
    console.log(`[locale-tour] report written to ${reportPath}`)

    process.exit(reconciled ? 0 : 1)
}

void main()
