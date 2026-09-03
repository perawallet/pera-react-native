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

import { http, HttpResponse, type HttpHandler, type PathParams } from 'msw'
import { decodeAddress } from 'algosdk'
import nacl from 'tweetnacl'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, decodeFromBase64 } from '@perawallet/wallet-core-shared'
import { encryptItemPayload } from '../crypto/itemPayload'
import { backupIdToAddress } from '../crypto/backupIdToAddress'
import type { BackupId, BackupItemKey } from '../models'
import { API_PREFIX, backupRoot } from './constants'

/** Host-agnostic match for one backup's routes: the handlers are mounted against
 *  whatever base URL the caller's client uses. */
const backupRootPattern = (backupId: BackupId): string =>
    `*${backupRoot(backupId)}`

/** Rejects with the canonical string the two sides disagreed on rather than a
 *  bare 401, so a signing mismatch is readable from the test output. */
class BackupSignatureError extends Error {
    constructor(detail: string) {
        super(`Backup request failed signature verification: ${detail}`)
        this.name = 'BackupSignatureError'
    }
}

/** Re-derived here rather than by calling our own `buildBackupRequestMessage`:
 *  verifying the client against its own builder would hide drift from the
 *  server's `getSignedPath` + `Ed25519SignatureVerifier`. */
const serverSideMessage = (request: Request, body: string, nonce: string) =>
    [
        request.method.toUpperCase(),
        decodeURIComponent(new URL(request.url).pathname),
        bytesToHex(sha256(new TextEncoder().encode(body))),
        nonce,
    ].join('|')

const createAuthorizer = (
    backupId: BackupId,
    verifySignatures: boolean,
): ((request: Request) => Promise<void>) => {
    if (!verifySignatures) return async () => undefined

    // The client derives both from one keypair, so the address the backupId
    // encodes carries the key the backup was registered under.
    const registeredAuthKey = decodeAddress(
        backupIdToAddress(backupId),
    ).publicKey
    const seenNonces = new Set<string>()

    return async request => {
        const nonce = request.headers.get('x-nonce')
        const signature = request.headers.get('x-signature')
        if (!nonce || !signature) {
            throw new BackupSignatureError('missing x-nonce or x-signature')
        }

        const message = serverSideMessage(
            request,
            await request.clone().text(),
            nonce,
        )

        // tweetnacl rejects a Uint8Array from another realm and jsdom hands
        // back its own, so re-wrap all three.
        const verified = nacl.sign.detached.verify(
            Uint8Array.from(new TextEncoder().encode(message)),
            Uint8Array.from(decodeFromBase64(signature)),
            Uint8Array.from(registeredAuthKey),
        )
        if (!verified) {
            throw new BackupSignatureError(`bad signature for "${message}"`)
        }

        // Signature before replay: ky retries GET and DELETE with the headers
        // it already signed, so a nonce-first check would report every signing
        // bug as a replay.
        if (seenNonces.has(nonce)) {
            throw new BackupSignatureError(`nonce already used: ${nonce}`)
        }
        seenNonces.add(nonce)
    }
}

/** On by default, so client/server signing drift fails a flow test. Off only
 *  for callers driving the routes with bare `fetch` — verification needs the
 *  backupId to encode a real address. */
type SignatureVerification = { verifySignatures?: boolean }

export type RestoreFixtureItem = {
    /** The backup item key (e.g. an account address). */
    key: BackupItemKey
    /** Raw UTF-8 plaintext — will be encrypted in the handler response. */
    plaintext: string
    /** Item version; defaults to `1`. */
    ver?: number
    /**
     * Item hash; defaults to `'sha256:fixture'`.
     */
    hash?: string
}

export type BuildRestoreHandlersParams = SignatureVerification & {
    backupId: BackupId
    encryptionKey: Uint8Array
    items: RestoreFixtureItem[]
}

export const buildRestoreHandlers = ({
    backupId,
    encryptionKey,
    items,
    verifySignatures = true,
}: BuildRestoreHandlersParams): HttpHandler[] => {
    const authorize = createAuthorizer(backupId, verifySignatures)
    const resolvedItems = items.map((item, index) => ({
        key: item.key,
        plaintext: item.plaintext,
        ver: item.ver ?? 1,
        hash: item.hash ?? 'sha256:fixture',
        seq: index + 1,
    }))

    const root = backupRootPattern(backupId)

    const manifestHandler = http.get(
        `${root}/manifest`,
        async ({ request }) => {
            await authorize(request)
            const manifestItems: Record<
                string,
                {
                    key: string
                    type: 'ACCOUNT'
                    ver: number
                    status: 'ACTIVE'
                    hash: string
                    last_seq: number
                }
            > = {}

            for (const item of resolvedItems) {
                manifestItems[item.key] = {
                    key: item.key,
                    type: 'ACCOUNT',
                    ver: item.ver,
                    status: 'ACTIVE',
                    hash: item.hash,
                    last_seq: item.seq,
                }
            }

            return HttpResponse.json({
                backup_id: backupId,
                backup_global_hash: 'sha256:global',
                global_version: resolvedItems.length,
                last_seq: resolvedItems.length,
                generated_at: new Date().toISOString(),
                items: manifestItems,
            })
        },
    )

    const deltaHandler = http.get(`${root}/delta`, async ({ request }) => {
        await authorize(request)
        const url = new URL(request.url)
        const fromSeq = Number(url.searchParams.get('from_seq') ?? '0')

        const entries = resolvedItems
            .filter(item => item.seq > fromSeq)
            .map(item => ({
                seq: item.seq,
                key: item.key,
                type: 'ACCOUNT' as const,
                ver: item.ver,
                status: 'ACTIVE' as const,
                op: 'UPSERT' as const,
                hash: item.hash,
            }))

        return HttpResponse.json({ entries })
    })

    const itemsReadHandler = http.post(
        `${root}/items/read`,
        async ({ request }) => {
            await authorize(request)
            const body = (await request.json()) as { keys: string[] }
            const requestedKeys: BackupItemKey[] = Array.isArray(body?.keys)
                ? body.keys
                : []

            const itemByKey = new Map(
                resolvedItems.map(item => [item.key, item]),
            )

            const responseItems = requestedKeys.map(key => {
                const item = itemByKey.get(key)
                if (!item) {
                    return { key, status: 'NOT_FOUND' as const }
                }

                const payload = encryptItemPayload(item.plaintext, {
                    encryptionKey,
                    backupId,
                    key,
                })

                return {
                    key,
                    status: 'FOUND' as const,
                    ver: item.ver,
                    hash: item.hash,
                    payload,
                }
            })

            return HttpResponse.json({ items: responseItems })
        },
    )

    return [manifestHandler, deltaHandler, itemsReadHandler]
}

export type BuildRegisterHandlerParams = {
    /** Receives the parsed request body on every register attempt. */
    onRegister?: (body: unknown) => void
    /** Response status; >= 400 answers with an empty error body. */
    status?: number
}

export const buildRegisterHandler = ({
    onRegister,
    status = 200,
}: BuildRegisterHandlerParams = {}): HttpHandler =>
    http.post(`*${API_PREFIX}/backup/register`, async ({ request }) => {
        onRegister?.(await request.json())
        return status >= 400
            ? new HttpResponse(null, { status })
            : HttpResponse.json({ ok: true }, { status })
    })

// ---------------------------------------------------------------------------
// buildSyncHandlers — stateful MSW factory for sync engine tests
// ---------------------------------------------------------------------------

type SyncStoreItem = {
    key: string
    payload: string
    ver: number
    hash: string
    seq: number
    status: 'ACTIVE' | 'IGNORED'
}

type UpsertRequestEntry = {
    key: string
    expected_ver: number
    payload: string
    status: SyncStoreItem['status']
}

/** One backup's server-side state: the items, the monotonic sequence every
 *  delta is cut from, and the forced conflicts a test has armed. */
const createFakeBackend = (initial: { key: string; payload: string }[]) => {
    const items = new Map<string, SyncStoreItem>()
    const armedConflicts = new Set<string>()
    let seq = 0
    let globalVersion = 0
    // The server writes the manifest on the first upsert or delete and never
    // removes it, so it is absent only before the first write.
    let manifestWritten = false

    const putItem = (
        key: string,
        payload: string,
        status: SyncStoreItem['status'] = 'ACTIVE',
    ): SyncStoreItem => {
        seq += 1
        globalVersion += 1
        manifestWritten = true
        const stored: SyncStoreItem = {
            key,
            payload,
            ver: (items.get(key)?.ver ?? 0) + 1,
            hash: `sha256:${seq}`,
            seq,
            status,
        }
        items.set(key, stored)
        return stored
    }

    for (const item of initial) putItem(item.key, item.payload)

    return {
        putItem,
        getItem: (key: string): SyncStoreItem | undefined => items.get(key),
        deleteItem: (key: string): number => {
            items.delete(key)
            seq += 1
            globalVersion += 1
            manifestWritten = true
            return seq
        },
        allItems: (): SyncStoreItem[] => [...items.values()],
        itemsAfter: (fromSeq: number): SyncStoreItem[] =>
            [...items.values()].filter(item => item.seq > fromSeq),
        hasManifest: (): boolean => manifestWritten,
        armConflict: (key: string): void => void armedConflicts.add(key),
        /** One-shot: reports whether a conflict was armed, and disarms it. */
        takeArmedConflict: (key: string): boolean => armedConflicts.delete(key),
        summary: () => ({
            globalVersion,
            lastSeq: seq,
            globalHash: `sha256:global:${globalVersion}`,
        }),
    }
}

type FakeBackend = ReturnType<typeof createFakeBackend>

type SyncRouteContext = {
    root: string
    backupId: BackupId
    backend: FakeBackend
    /** Verifies the request and records its sender; every route runs it first. */
    receive: (request: Request) => Promise<void>
}

const toManifestEntry = (item: SyncStoreItem) => ({
    key: item.key,
    type: 'ACCOUNT' as const,
    ver: item.ver,
    status: item.status,
    hash: item.hash,
    last_seq: item.seq,
})

const toDeltaEntry = (item: SyncStoreItem) => ({
    seq: item.seq,
    key: item.key,
    type: 'ACCOUNT' as const,
    ver: item.ver,
    status: item.status,
    op: 'UPSERT' as const,
    hash: item.hash,
})

const itemKeyFromPath = (params: PathParams): string =>
    `${params.prefix}/${params.addr}`

const applyUpsertEntry = (backend: FakeBackend, entry: UpsertRequestEntry) => {
    if (backend.takeArmedConflict(entry.key)) {
        const current = backend.getItem(entry.key)
        return {
            key: entry.key,
            result: 'VERSION_CONFLICT' as const,
            current_ver: current?.ver ?? entry.expected_ver + 1,
            current_hash: current?.hash ?? 'sha256:conflict',
        }
    }
    const stored = backend.putItem(entry.key, entry.payload, entry.status)
    return {
        key: entry.key,
        result: 'OK' as const,
        new_ver: stored.ver,
        seq: stored.seq,
    }
}

const manifestRoute = ({
    root,
    backupId,
    backend,
    receive,
}: SyncRouteContext): HttpHandler =>
    http.get(`${root}/manifest`, async ({ request }) => {
        await receive(request)
        if (!backend.hasManifest()) {
            return HttpResponse.json(
                { error: 'BACKUP_NOT_FOUND' },
                { status: 404 },
            )
        }

        const { globalVersion, lastSeq, globalHash } = backend.summary()
        return HttpResponse.json({
            backup_id: backupId,
            backup_global_hash: globalHash,
            global_version: globalVersion,
            last_seq: lastSeq,
            generated_at: new Date().toISOString(),
            items: Object.fromEntries(
                backend
                    .allItems()
                    .map(item => [item.key, toManifestEntry(item)]),
            ),
        })
    })

const deltaRoute = ({
    root,
    backend,
    receive,
}: SyncRouteContext): HttpHandler =>
    http.get(`${root}/delta`, async ({ request }) => {
        await receive(request)
        const fromSeq = Number(
            new URL(request.url).searchParams.get('from_seq') ?? '0',
        )
        return HttpResponse.json({
            entries: backend.itemsAfter(fromSeq).map(toDeltaEntry),
        })
    })

const readItemsRoute = ({
    root,
    backend,
    receive,
}: SyncRouteContext): HttpHandler =>
    http.post(`${root}/items/read`, async ({ request }) => {
        await receive(request)
        const { keys = [] } = (await request.json()) as { keys?: string[] }
        return HttpResponse.json({
            items: keys.map(key => {
                const item = backend.getItem(key)
                return item
                    ? {
                          key,
                          status: 'FOUND' as const,
                          ver: item.ver,
                          hash: item.hash,
                          payload: item.payload,
                      }
                    : { key, status: 'NOT_FOUND' as const }
            }),
        })
    })

const batchUpsertRoute = ({
    root,
    backend,
    receive,
}: SyncRouteContext): HttpHandler =>
    http.post(`${root}/items/upsert`, async ({ request }) => {
        await receive(request)
        const { items } = (await request.json()) as {
            items: UpsertRequestEntry[]
        }
        return HttpResponse.json({
            results: items.map(entry => applyUpsertEntry(backend, entry)),
        })
    })

const putItemRoute = ({
    root,
    backend,
    receive,
}: SyncRouteContext): HttpHandler =>
    http.put(`${root}/:prefix/:addr`, async ({ params, request }) => {
        await receive(request)
        const { payload, status } = (await request.json()) as {
            payload: string
            status: SyncStoreItem['status']
        }
        const stored = backend.putItem(itemKeyFromPath(params), payload, status)
        return HttpResponse.json({ new_ver: stored.ver, seq: stored.seq })
    })

const deleteItemRoute = ({
    root,
    backend,
    receive,
}: SyncRouteContext): HttpHandler =>
    http.delete(`${root}/:prefix/:addr`, async ({ params, request }) => {
        await receive(request)
        return HttpResponse.json({
            seq: backend.deleteItem(itemKeyFromPath(params)),
        })
    })

export type BuildSyncHandlersParams = SignatureVerification & {
    backupId: BackupId
    /** Optional seed items (already-encrypted payloads). */
    initial?: { key: string; payload: string }[]
}

export type SyncHandlerHandle = {
    handlers: HttpHandler[]
    getItem: (key: string) => SyncStoreItem | undefined
    /** Force the next upsert of `key` to report VERSION_CONFLICT. */
    forceConflict: (key: string) => void
    /** Payload must already be encrypted, as it arrives on the wire. Advances
     *  the sequence, so a delta from the client's cursor returns it. */
    pushFromOtherDevice: (key: string, payload: string) => void
    /** `x-device-id` of every request served, in order. */
    seenDeviceIds: () => string[]
}

export const buildSyncHandlers = ({
    backupId,
    initial = [],
    verifySignatures = true,
}: BuildSyncHandlersParams): SyncHandlerHandle => {
    const backend = createFakeBackend(initial)
    const verify = createAuthorizer(backupId, verifySignatures)
    const deviceIds: string[] = []

    const context: SyncRouteContext = {
        root: backupRootPattern(backupId),
        backupId,
        backend,
        receive: async request => {
            await verify(request)
            deviceIds.push(request.headers.get('x-device-id') ?? '')
        },
    }

    return {
        handlers: [
            manifestRoute(context),
            deltaRoute(context),
            readItemsRoute(context),
            batchUpsertRoute(context),
            putItemRoute(context),
            deleteItemRoute(context),
        ],
        getItem: backend.getItem,
        forceConflict: backend.armConflict,
        pushFromOtherDevice: (key, payload) =>
            void backend.putItem(key, payload),
        seenDeviceIds: () => [...deviceIds],
    }
}
