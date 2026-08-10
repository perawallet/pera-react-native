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

// Dedicated worker hosting sqlite-wasm over OPFS. The SyncAccessHandle pool VFS
// needs no COOP/COEP/SharedArrayBuffer, but sync access handles only exist
// inside dedicated workers — which is why the offscreen document spawns this
// rather than opening the DB itself.
//
// Result semantics match the drizzle sqlite-proxy callbacks elsewhere: `run`
// returns no rows, everything else an array of row VALUE arrays.
//
// MUST be instantiated with `new Worker(url, { type: 'module' })` — the
// bootstrap depends on module semantics for top-level await.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'

type WorkerRequest =
    | {
          id: number
          op: 'exec'
          name: string
          sql: string
          params: unknown[]
          method: 'run' | 'all' | 'values' | 'get'
      }
    | { id: number; op: 'delete'; name: string }

type WorkerResponse =
    | { id: number; ok: true; rows: unknown[][] }
    | { id: number; ok: false; error: string }

// Startup failure announcement. Deliberately id-less: it answers no single
// request, it condemns the worker. The executor treats it exactly like an
// 'error' event (see createWorkerExecutor) — keep the two in sync.
type WorkerFatal = { fatal: true; error: string }

// sqlite-wasm 3.53's published .d.mts intentionally omits the init
// function's parameter list (see sqlite/sqlite-wasm#129) even though the
// runtime (dist/index.mjs) still reads `locateFile`/`print`/`printErr` off
// the first argument, same as older Emscripten-based builds. Narrowing the
// import's type locally so we can pass that config without widening the
// public SqlExecutor/host surface.
const initSqlite3 = sqlite3InitModule as unknown as (options: {
    locateFile: (file: string) => string
    print?: (message: string) => void
    printErr?: (message: string) => void
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- Sqlite3Static shape, not our SqlExecutor surface
}) => Promise<any>

const ready = (async () => {
    const sqlite3 = await initSqlite3({
        // The wasm binary sits next to this bundled worker at the dist root
        // (copied by scripts/build.mjs). chrome.* APIs are unavailable in
        // workers, so resolve relative to the worker script URL.
        locateFile: (file: string) => new URL(file, self.location.href).href,
        print: () => undefined,
        printErr: (message: string) => console.error('[db-worker]', message),
    })
    const poolUtil = await sqlite3.installOpfsSAHPoolVfs({
        directory: '.pera-sqlite',
    })
    return poolUtil
})()

// A rejected `ready` is fatal and unrecoverable for this worker: either the
// SAH pool is already held by another worker (the OPFS
// NoModificationAllowedError seen when a second one spawns) or the wasm
// failed to load. Without this the worker just answers `{ok: false}` to every
// request forever, and — critically — neither 'error' nor 'messageerror'
// fires, which is the ONLY way the host detects a dead worker. The offscreen
// document would therefore stay alive, `chrome.offscreen.hasDocument()` would
// keep returning true, `ensureOffscreenDocument` would stay a no-op, and the
// database would be unreachable until the user manually reloaded the
// extension. Announcing it turns that into the existing recovery path:
// executor death -> host un-ready -> offscreen self-close -> recreate.
void ready.catch((error: unknown) => {
    const fatal: WorkerFatal = {
        fatal: true,
        error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(fatal)
})

// oxlint-disable-next-line -- sqlite-wasm's oo1 DB type is provided by the lib
const databases = new Map<string, any>()

const getDb = async (name: string): Promise<unknown> => {
    const poolUtil = await ready
    let db = databases.get(name)
    if (!db) {
        db = new poolUtil.OpfsSAHPoolDb(`/${name}`)
        databases.set(name, db)
    }
    return db
}

const respond = (response: WorkerResponse): void => {
    self.postMessage(response)
}

self.onmessage = async (event: MessageEvent<WorkerRequest>): Promise<void> => {
    if (event.origin && event.origin !== location.origin) return
    const message = event.data
    try {
        if (message.op === 'delete') {
            const poolUtil = await ready
            const db = databases.get(message.name)
            if (db) {
                db.close()
                databases.delete(message.name)
            }
            poolUtil.unlink(`/${message.name}`)
            respond({ id: message.id, ok: true, rows: [] })
            return
        }
        // oxlint-disable-next-line -- oo1 DB API
        const db = (await getDb(message.name)) as any
        const bind = message.params.map(value =>
            value === undefined ? null : value,
        )
        if (message.method === 'run') {
            db.exec({
                sql: message.sql,
                bind: bind.length > 0 ? bind : undefined,
            })
            respond({ id: message.id, ok: true, rows: [] })
            return
        }
        const rows: unknown[][] = []
        db.exec({
            sql: message.sql,
            bind: bind.length > 0 ? bind : undefined,
            rowMode: 'array',
            resultRows: rows,
        })
        respond({ id: message.id, ok: true, rows })
    } catch (error) {
        respond({
            id: message.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        })
    }
}
