*** Settings ***
Documentation       Accounts on Android and iOS from one suite: the account home, switcher, add-account
...                 entry, account options (rename, remove, passphrase), receive and the Menu tab.
...                 Every case starts from Home with a fresh back stack, so it runs or fails alone.
Resource            ../resources/accounts.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Run Keyword If Test Failed    Capture Page Screenshot
Test Tags           accounts


*** Variables ***
${FUNDED_ADDRESS}       %{E2E_FUNDED_ADDRESS=}


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
    Open Menu
    Tap    ${MENU_SETTINGS_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_SECURITY_ITEM}    timeout=20s

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

Receive Opens The Account QR
    [Tags]    id:accounts.receive.qr    p0    rc
    Tap    ${RECEIVE_BUTTON}
    Wait Until Page Contains Element    ${RECEIVE_COPY_ADDRESS_BUTTON}    timeout=20s
    Page Should Contain Element    ${RECEIVE_SHARE_ADDRESS_BUTTON}

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
    Wait Until Settled    ${PASSPHRASE_ACK_REVEAL}
    FOR    ${i}    IN RANGE    4
        Tap    ${PASSPHRASE_ACK_ROW}${i}
    END
    Tap    ${PASSPHRASE_ACK_REVEAL}
    Wait Until Page Contains Element    ${PASSPHRASE_GRID}    timeout=20s

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
    Tap    ${REMOVE_CONFIRM_BUTTON}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s
    ${after}=    Count Accounts
    Should Be Equal As Integers    ${after}    ${before - 1}

Funded Account Shows Portfolio And ALGO Holding
    [Tags]    id:accounts.portfolio.funded    p0    needs-funded    excludefromci    testnet-exec
    Skip If    not $FUNDED_ADDRESS    E2E_FUNDED_ADDRESS is not set.
    Switch To Testnet
    Select Watch Account    ${FUNDED_ADDRESS}
    Wait Until Page Contains Element    ${ACCOUNT_PORTFOLIO}    timeout=40s
    # A zero-balance account shows the deposit empty state instead of an ALGO row.
    Wait Until Page Contains Element    ${ALGO_HOLDING_ROW}    timeout=30s
