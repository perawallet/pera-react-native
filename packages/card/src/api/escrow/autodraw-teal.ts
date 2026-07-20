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

// SWAP POINT: AppliedBlockchain (AB) AutoDraw delegated LogicSig template.
//
// Vendored VERBATIM from AB's demo (`src/teal/AutoDraw.teal`, #pragma version
// 11). The four `TMPL_` placeholders are string-substituted with the escrow
// chain config (asset id, killswitch app id, W3Card app id, genesis hash) and
// compiled by algod before the user signs it. KEEP THIS BYTE-IDENTICAL to AB's
// template — the compiled program is what the delegation authorizes, and any
// drift changes the LogicSig address AB's contract expects. When AB updates the
// contract, replace this constant wholesale.

/** Placeholder for the settlement asset id (`TMPL_ASSET`). */
export const TMPL_ASSET = 'TMPL_ASSET'
/** Placeholder for the Killswitch application id (`TMPL_KILLSWITCH_APP`). */
export const TMPL_KILLSWITCH_APP = 'TMPL_KILLSWITCH_APP'
/** Placeholder for the W3Card (main) application id (`TMPL_MAIN_APP`). */
export const TMPL_MAIN_APP = 'TMPL_MAIN_APP'
/** Placeholder for the network genesis hash, substituted as `0x<hex>`. */
export const TMPL_GENESIS_HASH = 'TMPL_GENESIS_HASH'

export const AUTODRAW_TEAL_TEMPLATE = `#pragma version 11
#pragma typetrack false

// contracts/AutoDraw.algo.ts::program() -> uint64:
main:
    intcblock 1 4 6 0 TMPL_ASSET TMPL_KILLSWITCH_APP TMPL_MAIN_APP
    bytecblock TMPL_GENESIS_HASH
    // contracts/AutoDraw.algo.ts:12
    // const txnAutoDraw = gtxn.AssetTransferTxn(Txn.groupIndex)
    txn GroupIndex
    dup
    gtxns TypeEnum
    intc_1 // axfer
    ==
    assert // transaction type is axfer
    // contracts/AutoDraw.algo.ts:25
    // assert(txnAutoDraw.rekeyTo === Global.zeroAddress, 'REKEY_NOT_ALLOWED')
    dup
    gtxns RekeyTo
    global ZeroAddress
    ==
    assert // REKEY_NOT_ALLOWED
    // contracts/AutoDraw.algo.ts:29
    // assert(txnAutoDraw.assetCloseTo === Global.zeroAddress, 'ASSET_CLOSE_NOT_ALLOWED')
    dup
    gtxns AssetCloseTo
    global ZeroAddress
    ==
    assert // ASSET_CLOSE_NOT_ALLOWED
    // contracts/AutoDraw.algo.ts:33
    // assert(Global.genesisHash === TemplateVar<bytes>('GENESIS_HASH'), 'BAD_NETWORK')
    global GenesisHash
    bytec_0 // TMPL_GENESIS_HASH
    ==
    assert // BAD_NETWORK
    // contracts/AutoDraw.algo.ts:37
    // assert(txnAutoDraw.xferAsset === TemplateVar<Asset>('ASSET'), 'BAD_ASSET')
    dup
    gtxns XferAsset
    dup
    intc 4 // TMPL_ASSET
    ==
    assert // BAD_ASSET
    // contracts/AutoDraw.algo.ts:41
    // assert(txnAutoDraw.fee === 0, 'NON-ZERO_FEE')
    dig 1
    gtxns Fee
    !
    assert // NON-ZERO_FEE
    // contracts/AutoDraw.algo.ts:52
    // const txnKillswitch = gtxn.ApplicationCallTxn(Txn.groupIndex + 1)
    txn GroupIndex
    intc_0 // 1
    +
    dup
    gtxns TypeEnum
    intc_2 // appl
    ==
    assert // transaction type is appl
    // contracts/AutoDraw.algo.ts:57
    // assert(txnKillswitch.appId === TemplateVar<Application>('KILLSWITCH_APP'), 'BAD_KILLSWITCH_APP')
    dup
    gtxns ApplicationID
    intc 5 // TMPL_KILLSWITCH_APP
    ==
    assert // BAD_KILLSWITCH_APP
    // contracts/AutoDraw.algo.ts:61
    // assert(txnKillswitch.onCompletion === OnCompleteAction.NoOp, 'BAD_KILLSWITCH_OC')
    dup
    gtxns OnCompletion
    !
    assert // BAD_KILLSWITCH_OC
    // contracts/AutoDraw.algo.ts:65
    // assert(txnKillswitch.appArgs(0) === killswitchMethod, 'BAD_KILLSWITCH_METHOD')
    dup
    intc_3 // 0
    gtxnsas ApplicationArgs
    pushbytes 0x73bc6501 // method "authorize(address)void"
    ==
    assert // BAD_KILLSWITCH_METHOD
    // contracts/AutoDraw.algo.ts:70
    // assert(txnKillswitch.appArgs(1) === txnAutoDraw.sender.bytes, 'AUTH_MISMATCH')
    intc_0 // 1
    gtxnsas ApplicationArgs
    dig 2
    gtxns Sender
    swap
    dig 1
    ==
    assert // AUTH_MISMATCH
    // contracts/AutoDraw.algo.ts:80
    // const txnMainDebit = gtxn.ApplicationCallTxn(Txn.groupIndex + 2)
    txn GroupIndex
    pushint 2 // 2
    +
    dup
    gtxns TypeEnum
    intc_2 // appl
    ==
    assert // transaction type is appl
    // contracts/AutoDraw.algo.ts:85
    // assert(txnMainDebit.appId === TemplateVar<Application>('MAIN_APP'), 'BAD_MAIN_APP')
    dup
    gtxns ApplicationID
    intc 6 // TMPL_MAIN_APP
    ==
    assert // BAD_MAIN_APP
    // contracts/AutoDraw.algo.ts:88
    // assert(txnMainDebit.onCompletion === OnCompleteAction.NoOp, 'BAD_MAIN_OC')
    dup
    gtxns OnCompletion
    !
    assert // BAD_MAIN_OC
    // contracts/AutoDraw.algo.ts:91
    // assert(txnMainDebit.appArgs(0) === mainMethod, 'BAD_MAIN_METHOD')
    dup
    intc_3 // 0
    gtxnsas ApplicationArgs
    pushbytes 0xad162624 // method "cardDebit(address,address,uint64,uint64,uint64,string)void"
    ==
    assert // BAD_MAIN_METHOD
    // contracts/AutoDraw.algo.ts:95
    // assert(txnMainDebit.appArgs(1) === txnAutoDraw.sender.bytes, 'SENDER_MISMATCH')
    dup
    intc_0 // 1
    gtxnsas ApplicationArgs
    uncover 2
    ==
    assert // SENDER_MISMATCH
    // contracts/AutoDraw.algo.ts:99
    // assert(txnMainDebit.appArgs(2) === txnAutoDraw.assetReceiver.bytes, 'RECEIVER_MISMATCH')
    dup
    pushint 2 // 2
    gtxnsas ApplicationArgs
    dig 3
    gtxns AssetReceiver
    ==
    assert // RECEIVER_MISMATCH
    // contracts/AutoDraw.algo.ts:103
    // assert(op.btoi(txnMainDebit.appArgs(3)) === txnAutoDraw.xferAsset.id, 'ASSET_MISMATCH')
    dup
    pushint 3 // 3
    gtxnsas ApplicationArgs
    btoi
    uncover 2
    ==
    assert // ASSET_MISMATCH
    // contracts/AutoDraw.algo.ts:107
    // assert(op.btoi(txnMainDebit.appArgs(4)) >= txnAutoDraw.assetAmount, 'BAD_AMOUNT')
    intc_1 // 4
    gtxnsas ApplicationArgs
    btoi
    swap
    gtxns AssetAmount
    >=
    assert // BAD_AMOUNT
    // contracts/AutoDraw.algo.ts:16
    // return true
    intc_0 // 1
    return
`
