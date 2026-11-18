*** Settings ***
Documentation       Links the OS hands to the app, warm and cold. Every case asserts the screen the link
...                 lands on and the values it carries. Nothing is ever submitted: the transfer and
...                 opt-in cases stop before their confirm slider, and the suite wallet is unfunded.
Resource            ../resources/deeplinks.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           deeplinks


*** Test Cases ***
Add Contact Link Opens A Prefilled Form That Saves
    [Tags]    id:deeplinks.add-contact.warm    p1
    Start With No Contacts
    Open Deeplink    ${ADD_CONTACT_LINK}
    Add Contact Form Should Be Prefilled
    Save Prefilled Link Contact

Add Contact Link Cold Starts Onto The Prefilled Form
    [Tags]    id:deeplinks.add-contact.cold    p1
    Start With No Contacts
    Open Deeplink Cold    ${ADD_CONTACT_LINK}
    Add Contact Form Should Be Prefilled    timeout=60s
    Wait Clear Of Startup Prompts
    Save Prefilled Link Contact

Watch Account Link Prefills The Address
    [Tags]    id:deeplinks.add-watch-account    p1
    Open Deeplink    ${WATCH_ACCOUNT_LINK}
    Input Should Hold    watch_account_address_input    ${LINK_ADDRESS}    timeout=15s
    Page Should Contain Element    ${WATCH_SUBMIT_BUTTON}

Account Detail Link Lands On Home
    [Tags]    id:deeplinks.account-detail    p1
    ${address}=    Suite Account Address
    Start On Settings
    Open Deeplink    perawallet://app/account-detail?address=${address}
    Should Be On Home

Unknown Pera Link Falls Back To Home
    [Tags]    id:deeplinks.unknown-path-home    p2
    Start On Settings
    Open Deeplink    ${UNKNOWN_PATH_LINK}
    Should Be On Home

Invalid Algorand Link Is Ignored
    [Documentation]    The OS listener drops links that do not parse before dispatch, so there is no
    ...                invalid-link toast here (that toast is for in-app sources such as the QR scanner).
    [Tags]    id:deeplinks.invalid-ignored    p1
    Start On Settings
    Open Deeplink    ${INVALID_ALGORAND_LINK}
    # Nothing to wait for when a link is dropped; give a mistaken dispatch time to show.
    Sleep    2s
    Page Should Contain Element    ${SETTINGS_ITEM_SECURITY}
    Page Should Not Contain Element    ${SEND_NEXT}
    Tap    ${SETTINGS_ITEM_SECURITY}
    Wait Until Page Contains Element    ${PIN_TOGGLE}    timeout=15s

ALGO Transfer Link Prefills Send And Refuses An Unfunded Sender
    [Tags]    id:deeplinks.algo-transfer.warm    p0
    Open Deeplink    ${ALGO_TRANSFER_LINK}
    Send Amount Should Be Prefilled
    Next Should Be Refused For Lack Of Funds

ALGO Transfer Link Cold Starts Onto Send
    [Tags]    id:deeplinks.algo-transfer.cold    p1
    Open Deeplink Cold    ${ALGO_TRANSFER_LINK}
    Wait Until Page Contains Element    ${SEND_NEXT}    timeout=60s
    # The startup prompts arrive over the send sheet and would swallow the taps below.
    Wait Clear Of Startup Prompts
    Send Amount Should Be Prefilled
    Next Should Be Refused For Lack Of Funds

Second Transfer Link Keeps The Open Send Draft
    [Tags]    id:deeplinks.algo-transfer.draft-preserved    p1
    Open Deeplink    ${ALGO_TRANSFER_LINK}
    Send Amount Should Be Prefilled
    Open Deeplink    algorand://${LINK_ADDRESS}?amount=2345678
    Wait Until Settled    ${SEND_NEXT}
    Page Should Contain Text    ${TRANSFER_ALGOS}
    Page Should Not Contain Text    2.345678
    Wait Until Settled    tid=send_close_button
    Tap    tid=send_close_button
    Wait Until Settled    tid=send_discard_confirm
    Tap    tid=send_discard_confirm
    Wait Until Page Does Not Contain Element    ${SEND_NEXT}    timeout=10s
    Should Be On Home

Asset Opt-In Link Asks For An Account Then Shows The Opt-In
    [Tags]    id:deeplinks.asset-opt-in    p1
    Open Deeplink    ${OPT_IN_LINK}
    Wait Until Settled    ${OPT_IN_ACCOUNT_ROW}
    Tap Upper Half    ${OPT_IN_ACCOUNT_ROW}
    Wait Until Settled    ${OPT_IN_COPY_ID}
    Page Should Contain Element    ${OPT_IN_CONFIRM}
    Page Should Contain Text    ${OPT_IN_ASSET_ID}

Link Fired While Locked Waits For The PIN
    [Tags]    id:deeplinks.locked.resumes-after-unlock    p1
    [Setup]    Run Keywords    Start With No Contacts    AND    Start On Security
    Require Regular Pin
    Lock By Restart
    Open Deeplink    ${ADD_CONTACT_LINK}
    Sleep    2s    reason=Give the link time to be handled before checking it did not lift the lock.
    Page Should Contain Element    ${PIN_VERIFY_TITLE}
    Unlock With Pin    ${REGULAR_PIN}
    Add Contact Form Should Be Prefilled
    Save Prefilled Link Contact
    [Teardown]    Turn Pin Off After Test
