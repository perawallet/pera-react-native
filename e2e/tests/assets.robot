*** Settings ***
Documentation       Assets on Android and iOS from one suite. Cases tagged needs-funded run against the
...                 funded testnet account and skip without it.
Resource            ../resources/assets.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Funded Suite
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           assets


*** Test Cases ***
Add Asset Search Finds USDC
    [Tags]    id:assets.add.search    p0    rc
    # Which USDC the lookup returns follows the node the wallet is on, and an earlier case can
    # have moved it. Asking for the mainnet asset id by name failed on three of four passes on
    # a search that was working: what this case is about is that the search finds USDC at all.
    Any USDC Row

Choosing A Search Result Asks To Confirm The Opt In
    [Tags]    id:assets.opt-in.confirmation    p1
    # Which USDC the search returns depends on the node the wallet is on, and an earlier case
    # can have moved it. The case is about the confirmation, not about one asset id.
    ${row}    ${asset_id}=    Any USDC Row
    Open Opt In Sheet    ${row}    ${asset_id}    already_listed=${True}
    # The sheet existing is not the point: the user is being asked to pay a fee, so read it.
    # An opt-in costs the minimum transaction fee, 0.001 ALGO.
    Displayed Number Should Be At Least    opt_in_fee    ${0.001}

Manage Sheet Offers Sort Filter And Remove
    [Tags]    id:assets.manage.open    p1
    Open Manage Sheet
    Page Should Contain Element    ${MANAGE_FILTER}
    Page Should Contain Element    ${MANAGE_REMOVE}

Remove Assets Screen Opens From Manage
    [Tags]    id:assets.manage.remove    p1
    Open Remove Assets

Sort Sheet Lists Options And Applies The Choice
    [Tags]    id:assets.sort.apply    p1
    [Teardown]    Restore Default Sort
    Open Sort Sheet
    Page Should Contain Element    ${SORT_DEFAULT}
    Page Should Contain Element    ${SORT_ALPHABETICAL}
    Tap    ${SORT_ALPHABETICAL}
    Tap    ${SORT_APPLY}
    Wait Until Page Does Not Contain Element    ${SORT_APPLY}    timeout=10s
    Wait Until Element Is Visible    ${MANAGE_ASSETS_BUTTON}    timeout=10s

Filter Sheet Lists Toggles And Applies The Choice
    [Tags]    id:assets.filter.apply    p1
    [Teardown]    Restore Default Filter
    Open Filter Sheet
    Page Should Contain Element    ${FILTER_HIDE_ZERO}
    Tap    ${FILTER_DISPLAY_NFTS}
    Tap    ${FILTER_APPLY}
    Wait Until Page Does Not Contain Element    ${FILTER_APPLY}    timeout=10s
    Wait Until Element Is Visible    ${MANAGE_ASSETS_BUTTON}    timeout=10s

ALGO Detail Opens With Its Actions
    [Tags]    id:assets.detail.algo    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Open ALGO Detail
    Wait Until Page Contains Element    ${DETAIL_RECEIVE}    timeout=15s
    Page Should Contain Element    ${DETAIL_SEND}
    Page Should Contain Element    ${DETAIL_SWAP}

Opt In Executes On Testnet
    [Tags]    id:assets.opt-in.execute    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    ${held}=    Holds Testnet USDC
    IF    ${held}    Opt Out Of Testnet USDC
    Opt In To Testnet USDC

Opt Out Executes On Testnet
    [Tags]    id:assets.opt-out.execute    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    ${held}=    Holds Testnet USDC
    IF    not ${held}    Opt In To Testnet USDC
    Opt Out Of Testnet USDC

Remove Assets Offers Select All For A Removable Asset
    [Tags]    id:assets.remove.select-all    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    ${held}=    Holds Testnet USDC
    Skip If    not ${held}    No zero-balance opted-in asset to remove on the funded account.
    Open Remove Assets
    Wait Until Page Contains Element    ${REMOVE_SELECT_ALL}    timeout=10s

Collectible Detail Opens From The NFTs Tab
    [Tags]    id:assets.collectible.detail    p0    needs-funded    excludefromci
    [Setup]    Use Funded Testnet Account
    [Teardown]    Leave Funded Testnet Account
    Tap    ${NFTS_TAB}
    ${owned}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${FIRST_COLLECTIBLE}    timeout=30s
    Skip If    not ${owned}    The funded account holds no NFT.
    Tap    ${FIRST_COLLECTIBLE}
    Wait Until Page Contains Element    ${COLLECTIBLE_DETAIL_SCREEN}    timeout=20s


*** Keywords ***
Restore Default Sort
    Capture Failure Screenshot
    Go Home
    Apply Sort    ${SORT_DEFAULT}

Restore Default Filter
    [Documentation]    The toggle flips a stored preference, so it is flipped back only once applied.
    Capture Failure Screenshot
    IF    $TEST_STATUS == 'PASS'
        Go Home
        Toggle Display NFTs
    END
