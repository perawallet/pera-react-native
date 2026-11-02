*** Settings ***
Documentation       Ethereum seed import and a Sepolia send. Build and secret requirements: README, "Ethereum".
Library             OperatingSystem
Resource            onboarding.resource
Resource            transactions.resource


*** Variables ***
# Display-only: this phrase holds no funds on any chain. ETHEREUM_VECTOR_ADDRESS is what
# `cast wallet address --mnemonic <phrase> --mnemonic-index 0` prints (m/44'/60'/0'/0/0), so the
# expectation comes from a tool other than the app's own derivation.
${ETHEREUM_VECTOR_MNEMONIC}        neither scout spread wide web reject pulse tent retire repair river visual alien same phrase artwork scout element parade fossil fly staff around click
${ETHEREUM_VECTOR_ADDRESS}         0x03Af7750c3F180Ba5c220da098147902cbF215a6
${ETHEREUM_FUNDED_MNEMONIC}        %{E2E_ETHEREUM_FUNDED_MNEMONIC=}
${ETHER_SEND_AMOUNT}               0.0001

${ETHEREUM_NETWORK_ROW}            tid=account_network_ethereum
${ETHEREUM_NETWORK_ADD}            tid=account_network_ethereum_add
${ETHEREUM_NETWORK_COPY}           tid=account_network_ethereum_copy
${SEPOLIA_RADIO}                   tid=node_settings_ethereum_sepolia_radio
${SEND_CHAIN_ETHEREUM}             tid=send_chain_row_ethereum
${SEND_ETHER_ROW}                  tid=asset-list-item-native
${SEND_SUCCESS}                    tid=send_success
${SEND_AWAITING_TITLE}             Transaction Submitted
${ETHEREUM_TX_ROW_PREFIX}          transaction_row_0x


*** Keywords ***
Import Ethereum Test Vector
    Set Environment Variable    E2E_ETHEREUM_VECTOR_MNEMONIC    ${ETHEREUM_VECTOR_MNEMONIC}
    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    E2E_ETHEREUM_VECTOR_MNEMONIC

Import Funded Ethereum Wallet
    Skip If    not $ETHEREUM_FUNDED_MNEMONIC
    ...    Set E2E_ETHEREUM_FUNDED_MNEMONIC to run the Sepolia send.
    Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    E2E_ETHEREUM_FUNDED_MNEMONIC

Ethereum Address Of Selected Account
    [Documentation]    The 0x address the account-options sheet shows for Ethereum, enabling the
    ...                chain first (which derives the key in the native keystore) when it is not yet.
    Open Account Options
    ${listed}=    Run Keyword And Return Status    Scroll Until Tappable    ${ETHEREUM_NETWORK_ROW}
    IF    not ${listed}
        Fail    No Ethereum row in the account options: the build must ship Ethereum (CHAINS) with it switched on.
    END
    ${needs_adding}=    Is Shown    ${ETHEREUM_NETWORK_ADD}
    IF    ${needs_adding}
        Tap    ${ETHEREUM_NETWORK_ADD}
        Unlock With Known Pins
        Wait Until Page Contains Element    ${ETHEREUM_NETWORK_COPY}    timeout=60s
    END
    ${text}=    Text Under    ${ETHEREUM_NETWORK_ROW}
    ${address}=    Evaluate    (__import__('re').search(r'0x[0-9a-fA-F]{40}', $text) or [None])[0]
    Should Not Be Equal    ${address}    ${None}
    ...    msg=The Ethereum row shows no 0x address: "${text}".
    RETURN    ${address}

Open Ether Amount Entry
    Tap    ${SEND_BUTTON}
    # With more than one chain enabled, Send asks which chain first.
    Wait Until Keyword Succeeds    30s    1s    Send Should Offer Ether Or Chains
    ${chooser}=    Is Shown    ${SEND_CHAIN_ETHEREUM}
    IF    ${chooser}    Tap    ${SEND_CHAIN_ETHEREUM}
    Wait Until Page Contains Element    ${SEND_ETHER_ROW}    timeout=30s
    Wait Until Settled    ${SEND_ETHER_ROW}
    Tap    ${SEND_ETHER_ROW}
    Acknowledge Send Info

Newest Ethereum Transaction Id
    [Documentation]    The hash of the first Ethereum row in History, or empty when there is none.
    ...                Ethereum hashes start with 0x and Algorand ids never do, so the prefix picks
    ...                out Ethereum rows alone.
    Wait Until Keyword Succeeds    45s    1s    History Should Be Loaded
    ${rows}=    Rows With Prefix    ${ETHEREUM_TX_ROW_PREFIX}
    ${found}=    Run Keyword And Return Status    Page Should Contain Element    ${rows}
    IF    not ${found}    RETURN    ${EMPTY}
    ${id}=    Get Test ID    ${rows}
    RETURN    ${{ $id.removeprefix('transaction_row_') }}

Send Should Offer Ether Or Chains
    ${chains}=    Is Shown    ${SEND_CHAIN_ETHEREUM}
    ${assets}=    Is Shown    ${SEND_ETHER_ROW}
    Should Be True    ${chains} or ${assets}    Send shows neither the chain list nor the asset list.

History Should Be Loaded
    ${empty}=    Run Keyword And Return Status    Page Should Contain Text    ${HISTORY_EMPTY_TEXT}
    ${rows}=    Is Shown    ${TX_ROW_ANY}
    Should Be True    ${empty} or ${rows}    History is still loading.

New Ethereum Transaction Should Be Listed
    [Documentation]    The send shows in History before the backend indexes it, as a Pending row. A
    ...                block mined before History opened makes it already confirmed, which also passes:
    ...                the pending state is asserted on the success screen.
    [Arguments]    ${previous}
    Pull To Refresh
    ${hash}=    Newest Ethereum Transaction Id
    Should Not Be Empty    ${hash}    msg=History lists no Ethereum transaction yet.
    Should Not Be Equal    ${hash}    ${previous}    msg=No new Ethereum transaction appeared in History.
    ${notice}=    Set Variable    tid=transaction_row_notice_${hash}
    ${noticed}=    Is Shown    ${notice}
    IF    ${noticed}
        ${text}=    Text Under    ${notice}
        Should Contain    ${text}    Pending    msg=The new row's notice reads "${text}".
    END
    RETURN    ${hash}

Ethereum Transaction Should Be Confirmed
    [Arguments]    ${hash}
    Pull To Refresh
    Page Should Contain Element    tid=transaction_row_${hash}
    Page Should Not Contain Element    tid=transaction_row_notice_${hash}
    ...    message=Transaction ${hash} is still pending or failed.

Pull To Refresh
    Swipe By Percent    50    40    50    85    duration=500ms

Leave Sepolia
    Capture Failure Screenshot
    IF    $ETHEREUM_FUNDED_MNEMONIC    Set Testnet    ${False}    ${SEPOLIA_RADIO}
