*** Settings ***
Documentation       Accounts on Android and iOS from one suite: the account home, switcher, add-account
...                 entry, account options (rename, remove, passphrase), receive and the Menu tab.
...                 Every case starts from Home with a fresh back stack, so it runs or fails alone.
Resource            ../resources/accounts.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           accounts


*** Variables ***
${FUNDED_ADDRESS}       %{E2E_FUNDED_ADDRESS=}
# A public address with no key on the device; watching it needs no funds or secrets.
${WATCH_ONLY_ADDRESS}   UUZB34HTTJ6GM2XB44YSL333AWASFH7K3HSAK7R2AOJ4POGUXQSZIUM5XM


*** Test Cases ***
Account Home Shows Selector And Actions
    [Tags]    id:accounts.home.panel    p0    rc
    Page Should Contain Element    ${ACCOUNT_SELECTION_BUTTON}
    Page Should Contain Element    ${RECEIVE_BUTTON}
    Page Should Contain Element    ${MORE_BUTTON}

Menu Tab Lists Core Entries
    [Tags]    id:accounts.menu.entries    p0    rc
    Open Menu
    Page Should Contain Element    ${MENU_STAKING_BUTTON}
    Page Should Contain Element    ${MENU_CONTACTS_BUTTON}

Menu Opens Settings
    [Tags]    id:accounts.menu.settings    p1
    Open Settings

Account Switcher Offers Add And Search
    [Tags]    id:accounts.switcher.controls    p1
    Open Account Switcher
    Page Should Contain Element    ${DRAWER_SEARCH_BUTTON}
    ${rows}=    Switcher Addresses
    Should Not Be Empty    ${rows}

Closing Account Switcher Returns Home
    [Tags]    id:accounts.switcher.close    p1
    Open Account Switcher
    Close Account Switcher
    Tap    ${MORE_BUTTON}
    Wait Until Settled    ${OPTION_COPY_ADDRESS}

Add Account Opens Account Types
    [Tags]    id:accounts.add.open    p1
    Open Account Switcher
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=20s
    Page Should Contain Element    ${ADD_ACCOUNT_CLOSE_BUTTON}

Account Options Open From More
    [Tags]    id:accounts.options.open    p0    rc
    Open Account Options
    Page Should Contain Element    ${ACCOUNT_TYPE_INFO_BUTTON}
    Page Should Contain Element    ${OPTION_RENAME}

Home Assets Show The Network Filter On A Multichain Build
    [Tags]    id:accounts.home.network-filter    p1
    Ensure Account On Ethereum
    Go Home
    Wait Until Page Contains Element    ${ASSET_NETWORK_FILTER}    timeout=30s
    Page Should Contain Element    ${ASSET_NETWORK_FILTER_ALL}
    Page Should Contain Element    ${ASSET_NETWORK_FILTER_ALGORAND}
    Page Should Contain Element    ${ASSET_NETWORK_FILTER_ETHEREUM}

Account On Ethereum Offers Copy And QR For Both Networks
    [Documentation]    Skips on a build without Ethereum. Once Ethereum is added its row trades the
    ...                add button for the same actions the Algorand row has.
    [Tags]    id:accounts.networks.ethereum-added    p1
    Ensure Account On Ethereum
    # Adding the network can leave the sheet scrolled, and Android lists only what is on screen.
    Go Home
    Open Account Options
    Page Should Contain Element    ${NETWORKS_TITLE}
    Page Should Contain Element    ${OPTION_ALGORAND_QR}
    Scroll Until Present    ${OPTION_ETHEREUM_QR}
    Page Should Contain Element    ${OPTION_ETHEREUM_COPY}
    Page Should Not Contain Element    ${OPTION_ETHEREUM_ADD}
    # The actions being there says nothing about what they act on; the row has to print an address.
    ${row}=    Text Under    ${OPTION_ETHEREUM_ROW}
    Should Match Regexp    ${row}    0x[0-9a-fA-F]{4}    msg=The Ethereum row shows no address: "${row}".

Algorand Row Expands To Its Minimum Balance And Rekey
    [Documentation]    An account on Algorand alone opens that row expanded, where a tap would fold it.
    [Tags]    id:accounts.networks.algorand-expanded    p2
    Open Account Options
    ${expanded}=    Run Keyword And Return Status
    ...    Page Should Contain Element    ${OPTION_ALGORAND_MIN_BALANCE}
    IF    not ${expanded}
        Scroll Until Tappable    ${OPTION_ALGORAND_EXPAND}
        Tap    ${OPTION_ALGORAND_EXPAND}
    END
    Wait Until Page Contains Element    ${OPTION_ALGORAND_MIN_BALANCE}    timeout=15s
    Scroll Until Present    ${OPTION_REKEY}

Account Type Info Opens Its Explanation
    [Tags]    id:accounts.type-info.sheet    p2
    Open Account Options
    Tap    ${ACCOUNT_TYPE_INFO_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_TYPE_INFO_LEARN_MORE}    timeout=15s

Wallet Structure Shows The Ethereum Icon For An Account On Ethereum
    [Documentation]    Skips on a build without Ethereum.
    [Tags]    id:accounts.structure.chain-icons    p2
    Ensure Account On Ethereum
    # Adding the network can leave the sheet scrolled past the toggle, which sits above the networks.
    Go Home
    Open Account Options
    Scroll Until Tappable    ${SEE_WALLET_STRUCTURE}
    Tap    ${SEE_WALLET_STRUCTURE}
    Wait Until Page Contains Element    ${STRUCTURE_ROW_ANY}    timeout=15s
    Page Should Contain Element    ${STRUCTURE_ETHEREUM_ICON}

Cancelling Removal Keeps The Account
    [Tags]    id:accounts.remove.cancel    p1
    ${before}=    Count Accounts
    Start Account Removal
    Tap    ${REMOVE_CANCEL_BUTTON}
    Wait Until Page Does Not Contain Element    ${REMOVE_CONFIRM_BUTTON}    timeout=10s
    ${after}=    Count Accounts
    Should Be Equal As Integers    ${after}    ${before}

Rename Saves The New Name
    [Tags]    id:accounts.rename.saves    p1
    # A fixed name could already be there from an earlier run and pass without a save.
    ${name}=    Evaluate    f"E2E {random.randint(10000, 99999)}"    modules=random
    Open Account Option    ${OPTION_RENAME}
    Wait Until Settled    ${RENAME_SAVE_BUTTON}
    Clear Text    ${RENAME_INPUT}
    Input Text    ${RENAME_INPUT}    ${name}
    Tap    ${RENAME_SAVE_BUTTON}
    Wait Until Page Does Not Contain Element    ${RENAME_INPUT}    timeout=10s
    Go Home
    Account Name Should Be    ${name}

View Passphrase Reveals The Words
    [Tags]    id:accounts.passphrase.reveal    p0
    Open Account Option    ${OPTION_VIEW_PASSPHRASE}
    Acknowledge And Reveal Passphrase

Switcher Row Selects That Account
    [Tags]    id:accounts.switcher.select    p1
    Ensure Two Accounts
    Open Account Switcher
    @{addresses}=    Switcher Addresses
    FOR    ${address}    IN    @{addresses}[:2]
        Go Home
        Open Account Switcher
        ${row}=    Switcher Row    ${address}
        Tap    ${row}
        Wait Until Switcher Closed
        Receive Should Show Address    ${address}
    END

Confirmed Removal Drops The Account
    [Tags]    id:accounts.remove.confirm    p1
    # Removes the account it adds, so the wallet is never left empty.
    Add Account To Wallet
    ${before}=    Count Accounts
    Start Account Removal
    # Home stays in the tree under the sheet; the sheet leaving is what proves removal finished.
    Confirm Removal Until The Sheet Goes
    ${after}=    Count Accounts
    Should Be Equal As Integers    ${after}    ${before - 1}

Token Approvals Open From The Ethereum Row
    [Documentation]    Skips on a build without Ethereum or with token approvals switched off. Only
    ...                reads the list: revoking signs a transaction.
    [Tags]    id:accounts.ethereum.token-approvals    p1
    Ensure Account On Ethereum
    # Options appear under a network's chevron, which is offered only when the chain has some.
    ${expandable}=    Run Keyword And Return Status    Scroll Until Present    ${OPTION_ETHEREUM_EXPAND}
    Skip If    not ${expandable}    Token approvals are switched off for Ethereum on this build.
    ${expanded}=    Run Keyword And Return Status    Page Should Contain Element    ${OPTION_TOKEN_APPROVALS}
    IF    not ${expanded}
        Scroll Until Tappable    ${OPTION_ETHEREUM_EXPAND}
        Tap    ${OPTION_ETHEREUM_EXPAND}
    END
    Scroll Until Tappable    ${OPTION_TOKEN_APPROVALS}
    Tap    ${OPTION_TOKEN_APPROVALS}
    Wait Until Page Contains Element    ${TOKEN_APPROVALS_SCREEN}    timeout=30s
    Wait Until Page Contains Element    ${TOKEN_APPROVALS_LOADED}    timeout=30s
    Page Should Not Contain Element    ${TOKEN_APPROVALS_RETRY}
    ...    message=The approvals list failed to load.

Watch Account Lists Algorand Alone And Offers No Key Actions
    [Documentation]    A watch account holds no key: nothing to reveal, rekey or derive Ethereum from.
    [Tags]    id:accounts.networks.watch-account    p1
    # The cases that follow act on the selected account and need one with a key.
    [Teardown]    Run Keywords    Capture Failure Screenshot    AND    Go Home
    ...    AND    Select Another Account Than    ${WATCH_ONLY_ADDRESS}
    Select Watch Account    ${WATCH_ONLY_ADDRESS}
    Open Account Options
    Options Should Offer No Key Actions
    # An absence only counts once every row has been on screen, and the sheet outgrows it.
    Scroll Until Tappable    ${OPTION_REMOVE}
    Options Should Offer No Key Actions

Funded Account Shows Portfolio And ALGO Holding
    [Tags]    id:accounts.portfolio.funded    p0    needs-funded    excludefromci    testnet-exec
    Skip If    not $FUNDED_ADDRESS    E2E_FUNDED_ADDRESS is not set.
    Switch To Testnet
    Select Watch Account    ${FUNDED_ADDRESS}
    Wait Until Page Contains Element    ${ACCOUNT_PORTFOLIO}    timeout=40s
    # A zero-balance account shows the deposit empty state instead of an ALGO row.
    Wait Until Page Contains Element    ${ALGO_HOLDING_ROW}    timeout=30s
    # Test funds never count toward a fiat total, so the TestNet header shows no fiat value.
    Page Should Not Contain Element    ${PORTFOLIO_PRIMARY_VALUE}
