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

import type { MigrationConfig } from '../migrator'

import m0000 from './0000_initial.sql?raw'
import m0001 from './0001_add_balance_impacts.sql?raw'
import m0002 from './0002_add_close_amount.sql?raw'
import m0003 from './0003_add_is_frozen.sql?raw'
import m0004 from './0004_add_asset_price_misses.sql?raw'
import m0005 from './0005_add_assets_pera_first_seen_at.sql?raw'
import m0006 from './0006_add_submission_attempts.sql?raw'
import m0007 from './0007_add_asset_sender.sql?raw'
import m0008 from './0008_scope_key_network.sql?raw'
import m0009 from './0009_transaction_identity.sql?raw'
import m0010 from './0010_text_asset_ids.sql?raw'
import m0011 from './0011_transactions_chain_data.sql?raw'
import m0012 from './0012_account_chain_state.sql?raw'
import m0013 from './0013_drop_account_balances.sql?raw'
import m0014 from './0014_holdings_native.sql?raw'
import m0015 from './0015_submission_attempts_nonce.sql?raw'
import m0016 from './0016_submission_attempts_history_entry.sql?raw'
import m0017 from './0017_submission_attempts_max_fee.sql?raw'
import m0018 from './0018_drop_transaction_algorand_columns.sql?raw'
import m0019 from './0019_chain_data_scope_columns.sql?raw'
import m0020 from './0020_collectible_uniqueness_backfill.sql?raw'
import m0021 from './0021_submission_attempts_replacement.sql?raw'

// Rows cached before the close_amount column heal in place via the chain
// backfill (chain-algorand's history-cache/close-amount-backfill.ts) — no
// cache-wiping migration needed.
export const migrations: MigrationConfig = {
    '0000_initial': m0000,
    '0001_add_balance_impacts': m0001,
    '0002_add_close_amount': m0002,
    // Holdings rows default to unfrozen and heal on the next account sync.
    '0003_add_is_frozen': m0003,
    // Durable "no price returned" markers so the price syncer can defer
    // retries across any portfolio size (replaces a capped in-memory map).
    '0004_add_asset_price_misses': m0004,
    // Nullable on purpose: rows cached before this column stay NULL, which
    // reads as "not newly seen" and keeps them on the long asset TTL.
    '0005_add_assets_pera_first_seen_at': m0005,
    // Submission ledger: one row per broadcast attempt, written
    // before the POST and resolved by confirmation / rejection / reconciler.
    '0006_add_submission_attempts': m0006,
    // A clawback's `asnd`. Rows cached before it stay NULL, which reads as
    // "the sender is the debited account". The syncer only fetches newer
    // transactions, so those rows are only corrected if another wallet account
    // syncs the same transaction for the first time.
    '0007_add_asset_sender': m0007,
    // Rewrites every bare network to its scope key. `NOT LIKE '%/%'` skips rows
    // already rewritten, so a rerun changes nothing.
    '0008_scope_key_network': m0008,
    // SQLite can't change a primary key or drop NOT NULL in place, so both
    // tables are rebuilt by copy. Existing rows default to 'confirmed'.
    '0009_transaction_identity': m0009,
    // Rebuilds the five asset caches so every asset_id is written by a text
    // column: a decimal-mapped id parsed `0x…` as hex. The first-tick force sync
    // refills them; account_balances and account_transactions are kept.
    '0010_text_asset_ids': m0010,
    // Nullable, and not backfilled: the syncer only fetches transactions newer
    // than the newest cached one, so a row cached before this keeps a NULL
    // chain_data until it is re-upserted. 0018 builds it from the old columns.
    '0011_transactions_chain_data': m0011,
    // Created empty; the syncer fills it and 0013 backfills the rest.
    '0012_account_chain_state': m0012,
    // Backfills the Algorand rows by string arithmetic, so no amount passes through a float; a row the dual-write already made wins.
    '0013_drop_account_balances': m0013,
    // The backfill means the first sync after upgrade writes nothing.
    '0014_holdings_native': m0014,
    // Nullable: Algorand rows have no account sequence number and stay NULL.
    '0015_submission_attempts_nonce': m0015,
    // Nullable: Algorand attempts and attempts recorded before it carry no history entry.
    '0016_submission_attempts_history_entry': m0016,
    // Nullable: Algorand attempts and attempts recorded before it carry no max fee.
    '0017_submission_attempts_max_fee': m0017,
    // Rebuilt by copy so chain_data can be NOT NULL. A row without a valid
    // document gets one built from the old columns; one with it keeps it, since every write path wrote both.
    '0018_drop_transaction_algorand_columns': m0018,
    // Copied in SQL before the drops so a pending attempt keeps its validity
    // window; the renames carry primary keys and indexes along.
    '0019_chain_data_scope_columns': m0019,
    // Writes Algorand's uniqueness flag (supply 1, no decimals) into cached
    // collectibles locally, so they don't read as editions until a refetch.
    '0020_collectible_uniqueness_backfill': m0020,
    // Nullable: Algorand attempts and attempts recorded before it carry neither.
    '0021_submission_attempts_replacement': m0021,
}
