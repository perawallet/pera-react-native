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

// AppliedBlockchain's AutoDraw delegated LogicSig template, vendored VERBATIM.
// KEEP IT BYTE-IDENTICAL — the compiled program is what the delegation
// authorizes, so any drift changes the LogicSig address AB's contract expects.
// Replace wholesale when AB updates the contract. Source:
// appliedblockchain/baanx-algo-contracts artifacts/AutoDraw.teal (main @ a3d4e6a).
//
// The three `TMPL_` placeholders are substituted with the escrow chain config
// and compiled by algod before the user signs. The settlement asset is
// deliberately NOT baked in: one LSig authorizes a draw of any asset, and
// per-asset gating happens via the Killswitch's `authorize(account, asset)`.

/** Placeholder for the Killswitch application id (`TMPL_KILLSWITCH_APP`). */
export const TMPL_KILLSWITCH_APP = 'TMPL_KILLSWITCH_APP'
/** Placeholder for the W3Card (main) application id (`TMPL_MAIN_APP`). */
export const TMPL_MAIN_APP = 'TMPL_MAIN_APP'
/** Placeholder for the network genesis hash, substituted as `0x<hex>`. */
export const TMPL_GENESIS_HASH = 'TMPL_GENESIS_HASH'

export const AUTODRAW_TEAL_TEMPLATE = `#pragma version 13
#pragma typetrack false
#pragma autosalt true

// contracts/AutoDraw.algo.ts::program() -> uint64:
main:
    intcblock 1 6 TMPL_KILLSWITCH_APP TMPL_MAIN_APP
    bytecblock TMPL_GENESIS_HASH
    // contracts/AutoDraw.algo.ts:26
    // const txnAutoDraw = gtxn.AssetTransferTxn(Txn.groupIndex)
    txn GroupIndex
    dup
    gtxns TypeEnum
    pushint 4 // axfer
    ==
    assert // transaction type is axfer
    // contracts/AutoDraw.algo.ts:39
    // assert(txnAutoDraw.rekeyTo === Global.zeroAddress, 'REKEY_NOT_ALLOWED')
    dup
    gtxns RekeyTo
    global ZeroAddress
    ==
    assert // REKEY_NOT_ALLOWED
    // contracts/AutoDraw.algo.ts:43
    // assert(txnAutoDraw.assetCloseTo === Global.zeroAddress, 'ASSET_CLOSE_NOT_ALLOWED')
    dup
    gtxns AssetCloseTo
    global ZeroAddress
    ==
    assert // ASSET_CLOSE_NOT_ALLOWED
    // contracts/AutoDraw.algo.ts:47
    // assert(txnAutoDraw.assetSender === Global.zeroAddress, 'CLAWBACK_NOT_ALLOWED')
    dup
    gtxns AssetSender
    global ZeroAddress
    ==
    assert // CLAWBACK_NOT_ALLOWED
    // contracts/AutoDraw.algo.ts:51
    // assert(Global.genesisHash === TemplateVar<bytes>('GENESIS_HASH'), 'BAD_NETWORK')
    global GenesisHash
    bytec_0 // TMPL_GENESIS_HASH
    ==
    assert // BAD_NETWORK
    // contracts/AutoDraw.algo.ts:55
    // assert(txnAutoDraw.fee === 0, 'NON-ZERO_FEE')
    dup
    gtxns Fee
    !
    assert // NON-ZERO_FEE
    // contracts/AutoDraw.algo.ts:65
    // const txnKillswitch = gtxn.ApplicationCallTxn(Txn.groupIndex + 1)
    txn GroupIndex
    intc_0 // 1
    +
    dup
    gtxns TypeEnum
    intc_1 // appl
    ==
    assert // transaction type is appl
    // contracts/AutoDraw.algo.ts:70
    // assert(txnKillswitch.appId === TemplateVar<Application>('KILLSWITCH_APP'), 'BAD_KILLSWITCH_APP')
    dup
    gtxns ApplicationID
    intc_2 // TMPL_KILLSWITCH_APP
    ==
    assert // BAD_KILLSWITCH_APP
    // contracts/AutoDraw.algo.ts:74
    // assert(txnKillswitch.onCompletion === OnCompleteAction.NoOp, 'BAD_KILLSWITCH_OC')
    dup
    gtxns OnCompletion
    !
    assert // BAD_KILLSWITCH_OC
    // contracts/AutoDraw.algo.ts:78
    // assert(txnKillswitch.appArgs(0) === killswitchMethod, 'BAD_KILLSWITCH_METHOD')
    dup
    gtxnsa ApplicationArgs 0
    pushbytes 0xa9312ef1 // method "authorize(address,uint64)void"
    ==
    assert // BAD_KILLSWITCH_METHOD
    // contracts/AutoDraw.algo.ts:83
    // assert(txnKillswitch.appArgs(1) === txnAutoDraw.sender.bytes, 'AUTH_MISMATCH')
    dup
    gtxnsa ApplicationArgs 1
    dig 2
    gtxns Sender
    swap
    dig 1
    ==
    assert // AUTH_MISMATCH
    // contracts/AutoDraw.algo.ts:89
    // assert(btoi(txnKillswitch.appArgs(2)) === txnAutoDraw.xferAsset.id, 'ASSET_MISMATCH_KILLSWITCH')
    swap
    gtxnsa ApplicationArgs 2
    btoi
    dig 2
    gtxns XferAsset
    swap
    dig 1
    ==
    assert // ASSET_MISMATCH_KILLSWITCH
    // contracts/AutoDraw.algo.ts:99
    // const txnMainDebit = gtxn.ApplicationCallTxn(Txn.groupIndex + 2)
    txn GroupIndex
    pushint 2
    +
    dup
    gtxns TypeEnum
    intc_1 // appl
    ==
    assert // transaction type is appl
    // contracts/AutoDraw.algo.ts:104
    // assert(txnMainDebit.appId === TemplateVar<Application>('MAIN_APP'), 'BAD_MAIN_APP')
    dup
    gtxns ApplicationID
    intc_3 // TMPL_MAIN_APP
    ==
    assert // BAD_MAIN_APP
    // contracts/AutoDraw.algo.ts:107
    // assert(txnMainDebit.onCompletion === OnCompleteAction.NoOp, 'BAD_MAIN_OC')
    dup
    gtxns OnCompletion
    !
    assert // BAD_MAIN_OC
    // contracts/AutoDraw.algo.ts:110
    // assert(txnMainDebit.appArgs(0) === mainMethod, 'BAD_MAIN_METHOD')
    dup
    gtxnsa ApplicationArgs 0
    pushbytes 0xad162624 // method "cardDebit(address,address,uint64,uint64,uint64,string)void"
    ==
    assert // BAD_MAIN_METHOD
    // contracts/AutoDraw.algo.ts:114
    // assert(txnMainDebit.appArgs(1) === txnAutoDraw.sender.bytes, 'SENDER_MISMATCH')
    dup
    gtxnsa ApplicationArgs 1
    uncover 3
    ==
    assert // SENDER_MISMATCH
    // contracts/AutoDraw.algo.ts:118
    // assert(txnMainDebit.appArgs(2) === txnAutoDraw.assetReceiver.bytes, 'RECEIVER_MISMATCH')
    dup
    gtxnsa ApplicationArgs 2
    dig 3
    gtxns AssetReceiver
    ==
    assert // RECEIVER_MISMATCH
    // contracts/AutoDraw.algo.ts:122
    // assert(btoi(txnMainDebit.appArgs(3)) === txnAutoDraw.xferAsset.id, 'ASSET_MISMATCH_MAIN')
    dup
    gtxnsa ApplicationArgs 3
    btoi
    uncover 2
    ==
    assert // ASSET_MISMATCH_MAIN
    // contracts/AutoDraw.algo.ts:126
    // assert(btoi(txnMainDebit.appArgs(4)) >= txnAutoDraw.assetAmount, 'BAD_AMOUNT')
    gtxnsa ApplicationArgs 4
    btoi
    swap
    gtxns AssetAmount
    >=
    assert // BAD_AMOUNT
    // contracts/AutoDraw.algo.ts:30
    // return true
    intc_0 // 1
    return
`
