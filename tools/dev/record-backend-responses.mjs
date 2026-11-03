#!/usr/bin/env node
// Record one response from each Pera backend route the EVM chains call, as
// the fixtures packages/chain-ethereum's *.contract.spec.ts files parse with the
// app's own schemas. Staging can't be recorded from here (its Cloudflare
// refuses anything but the app), so this runs the backend's own route tests in
// a local algorand-backend checkout: the real routes, controllers and
// serialization, over the fake storage those tests set up. No network, no key.
//
// Per route it keeps, of the 200 responses to a request the app would send,
// the one with the most rows (ties: the first), cut to its first MAX_ROWS rows;
// a row itself is never changed.
//
// Usage: node tools/dev/record-backend-responses.mjs <algorand-backend-checkout>

import { execFileSync, spawnSync } from 'node:child_process'
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const OUT_DIR = resolve(
    import.meta.dirname,
    '../../packages/chain-ethereum/src/__tests__/backend-recordings',
)
const PRELOAD = resolve(import.meta.dirname, 'backend-capture-preload.mjs')
const MAX_ROWS = 25

const CHAIN = '(\\d+)'
const ADDRESS = '(0x[0-9a-fA-F]{40})'

// The route tests mount the routers under varying prefixes, so the canonical
// path is rebuilt from the captured one. NFT holdings and NFT metadata, which
// the app also calls, are missing: the backend serves neither yet.
const ROUTES = [
    {
        name: 'assets',
        method: 'POST',
        match: new RegExp('^(?:/api/v4)?/assets/$'),
        // The app asks this route for EVM ids only.
        accepts: ({ requestBody }) =>
            Array.isArray(requestBody?.ids) &&
            requestBody.ids.every(id => String(id).startsWith('eip155:')),
        path: () => '/api/v4/assets/',
        tests: ['src/modules/assets/__tests__/assets.test.ts'],
    },
    {
        name: 'assets-chart',
        method: 'GET',
        match: new RegExp('^(?:/api/v4)?/assets/chart/$'),
        path: () => '/api/v4/assets/chart/',
        tests: [
            'src/modules/assets/__tests__/asset-chart.test.ts',
            'src/modules/evm/__tests__/chart.test.ts',
        ],
    },
    {
        name: 'evm-tokens',
        method: 'GET',
        match: new RegExp(`^(?:/api/v3)?/evm/${CHAIN}/tokens/$`),
        path: ([, chainId]) => `/api/v3/evm/${chainId}/tokens/`,
        pathParams: ([, chainId]) => ({ chainId: Number(chainId) }),
        tests: ['src/modules/evm/__tests__/tokens.test.ts'],
    },
    {
        name: 'evm-account-transactions',
        method: 'GET',
        match: new RegExp(
            `^(?:/api/v3)?/evm/${CHAIN}/accounts/${ADDRESS}/transactions/$`,
        ),
        path: ([, chainId, address]) =>
            `/api/v3/evm/${chainId}/accounts/${address}/transactions/`,
        pathParams: ([, chainId, address]) => ({
            chainId: Number(chainId),
            address,
        }),
        // The app pages with `cursor` and `limit` only; a filtered query
        // (`asset_id`) answers transfer-stream rows with most fields null.
        accepts: ({ params }) =>
            [...params.keys()].every(
                key => key === 'cursor' || key === 'limit',
            ),
        tests: ['src/modules/evm/__tests__/transactions.test.ts'],
    },
    {
        name: 'evm-balance-history',
        method: 'POST',
        match: new RegExp(`^(?:/api/v3)?/evm/${CHAIN}/balance-history/$`),
        path: ([, chainId]) => `/api/v3/evm/${chainId}/balance-history/`,
        pathParams: ([, chainId]) => ({ chainId: Number(chainId) }),
        // A suite that only exercises failed reads answers no balance at all.
        accepts: ({ body }) =>
            rowsOf(body)?.some(point => point.balances !== null) ?? false,
        // Kept whole: its read points can all sit past any cut.
        maxRows: Infinity,
        tests: ['src/modules/evm/__tests__/balance-history.test.ts'],
    },
    {
        name: 'accounts-should-refresh',
        method: 'POST',
        match: new RegExp('^(?:/api/v4)?/accounts/should-refresh/$'),
        // The Algorand /v1 route shares the path suffix; only EVM chains count.
        accepts: ({ requestBody }) =>
            String(requestBody?.chain ?? '').startsWith('eip155:'),
        path: () => '/api/v4/accounts/should-refresh/',
        tests: ['src/modules/evm/__tests__/should-refresh.test.ts'],
    },
]

const fail = message => {
    console.error(`ERROR: ${message}`)
    process.exit(1)
}

const [checkout] = process.argv.slice(2)
if (!checkout) {
    fail(
        'Usage: node tools/dev/record-backend-responses.mjs <algorand-backend-checkout>',
    )
}
const bunDir = resolve(checkout, 'bun')
if (!existsSync(join(bunDir, 'package.json'))) {
    fail(
        `${checkout} is not an algorand-backend checkout (no bun/package.json)`,
    )
}
if (!existsSync(join(bunDir, 'node_modules'))) {
    fail(`run \`bun install\` in ${bunDir} first`)
}

const revision = execFileSync(
    'git',
    ['-C', checkout, 'rev-parse', '--short', 'HEAD'],
    {
        encoding: 'utf8',
    },
).trim()

const workDir = mkdtempSync(join(tmpdir(), 'backend-recordings-'))
const capture = join(workDir, 'capture.jsonl')
// One process per file: the suites' module mocks are process-wide and clash.
for (const test of new Set(ROUTES.flatMap(route => route.tests))) {
    const run = spawnSync('bun', ['test', '--preload', PRELOAD, test], {
        cwd: bunDir,
        env: { ...process.env, CAPTURE_OUT: capture },
        stdio: ['ignore', 'ignore', 'inherit'],
    })
    if (run.status !== 0) {
        rmSync(workDir, { recursive: true, force: true })
        fail(`${test} failed (bun test exited ${run.status})`)
    }
}
const exchanges = existsSync(capture)
    ? readFileSync(capture, 'utf8')
          .trim()
          .split('\n')
          .map(line => JSON.parse(line))
    : []
rmSync(workDir, { recursive: true, force: true })

const parseJson = text => {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

const rowsOf = body => (Array.isArray(body) ? body : body?.results)

// Rows when the body has a list, else its field count: a should-refresh
// answer carrying `round` beats one without.
const scoreOf = body => rowsOf(body)?.length ?? Object.keys(body ?? {}).length

const trim = (requestBody, body, maxRows) => {
    const rows = rowsOf(body)
    if (!Array.isArray(rows) || rows.length <= maxRows) {
        return { requestBody, body }
    }
    const kept = rows.slice(0, maxRows)
    // Asset lookups answer one row per id in request order; cut both alike.
    const ids = requestBody?.ids
    return {
        requestBody:
            Array.isArray(ids) && ids.length === rows.length
                ? { ...requestBody, ids: ids.slice(0, maxRows) }
                : requestBody,
        body: Array.isArray(body) ? kept : { ...body, results: kept },
    }
}

const recordedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
const recordings = ROUTES.map(route => {
    const candidates = exchanges.flatMap(exchange => {
        const url = new URL(exchange.url)
        const match = route.match.exec(url.pathname)
        if (
            !match ||
            exchange.method !== route.method ||
            exchange.status !== 200
        ) {
            return []
        }
        const body = parseJson(exchange.body)
        const requestBody =
            exchange.requestBody === null
                ? undefined
                : parseJson(exchange.requestBody)
        if (
            body === undefined ||
            (route.accepts &&
                !route.accepts({ requestBody, body, params: url.searchParams }))
        ) {
            return []
        }
        return [{ url, match, body, requestBody }]
    })
    if (candidates.length === 0) {
        fail(
            `no 200 response of ${route.method} ${route.name} in ${route.tests.join(', ')}`,
        )
    }
    const best = candidates.reduce((top, candidate) =>
        scoreOf(candidate.body) > scoreOf(top.body) ? candidate : top,
    )
    const { requestBody, body } = trim(
        best.requestBody,
        best.body,
        route.maxRows ?? MAX_ROWS,
    )
    const params = Object.fromEntries(best.url.searchParams)
    return {
        name: route.name,
        recording: {
            request: {
                method: route.method,
                path: route.path(best.match),
                ...(route.pathParams && {
                    pathParams: route.pathParams(best.match),
                }),
                ...(Object.keys(params).length > 0 && { params }),
                ...(requestBody !== undefined && { body: requestBody }),
            },
            recordedFrom: `algorand-backend@${revision}`,
            recordedAt,
            response: body,
        },
    }
})

mkdirSync(OUT_DIR, { recursive: true })
for (const { name, recording } of recordings) {
    writeFileSync(
        join(OUT_DIR, `${name}.json`),
        `${JSON.stringify(recording, null, 4)}\n`,
    )
}
// In the repo formatter's style, so a refresh diffs only what the backend changed.
const format = spawnSync(
    'pnpm',
    [
        'exec',
        'oxfmt',
        ...recordings.map(({ name }) => join(OUT_DIR, `${name}.json`)),
    ],
    {
        cwd: resolve(import.meta.dirname, '../..'),
        stdio: ['ignore', 'ignore', 'inherit'],
    },
)
if (format.status !== 0) fail(`oxfmt exited ${format.status}`)
console.log(
    `Recorded ${recordings.length} responses from algorand-backend@${revision} into ${OUT_DIR}`,
)
