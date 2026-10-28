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
    Dismiss Keyboard
    Tap    ${ADD_CONTACT_BUTTON}
    Contact Row Should Be Listed    ${LINK_ADDRESS}

Add Contact Link Cold Starts Onto The Prefilled Form
    [Tags]    id:deeplinks.add-contact.cold    p1
    Open Deeplink Cold    ${ADD_CONTACT_LINK}
    Add Contact Form Should Be Prefilled    timeout=60s
    # The startup prompts arrive over whatever screen the link opened; clear them for the next case.
    Wait Clear Of Startup Prompts

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

Asset Opt-In Link Asks For An Account Then Shows The Opt-In
    [Tags]    id:deeplinks.asset-opt-in    p1
    Open Deeplink    ${OPT_IN_LINK}
    Wait Until Settled    ${OPT_IN_ACCOUNT_ROW}
    Tap Upper Half    ${OPT_IN_ACCOUNT_ROW}
    Wait Until Settled    ${OPT_IN_COPY_ID}
    Page Should Contain Element    ${OPT_IN_CONFIRM}
    Page Should Contain Text    ${OPT_IN_ASSET_ID}

Pasted Add Contact Link Opens The Prefilled Form
    [Documentation]    The paste sheet dispatches through the scanner's path, so a pasted link lands
    ...                where a scanned one does.
    [Tags]    id:deeplinks.paste.add-contact    p1
    Start With No Contacts
    Paste Link    ${ADD_CONTACT_LINK}
    Wait Until Page Does Not Contain Element    ${PASTE_LINK_INPUT}    timeout=15s
    Add Contact Form Should Be Prefilled

Pasted Text That Is Not A Link Is Refused In Place
    [Tags]    id:deeplinks.paste.invalid    p2
    Paste Link    not a link at all
    Wait Until Page Contains Element    ${PASTE_LINK_ERROR}    timeout=10s
    Page Should Contain Element    ${PASTE_LINK_INPUT}
    Close Sheet
    Wait Until Page Does Not Contain Element    ${PASTE_LINK_INPUT}    timeout=10s

Empty And Whitespace Pasted Links Cannot Be Submitted
    [Tags]    id:deeplinks.paste.empty-disabled    p1
    Open Paste Link
    Expect Element    ${PASTE_LINK_SUBMIT}    disabled    timeout=5s
    Input Text    ${PASTE_LINK_INPUT}    ${SPACE}${SPACE}${SPACE}
    Expect Element    ${PASTE_LINK_SUBMIT}    disabled    timeout=5s

An Invalid Pasted Link Can Be Corrected
    [Tags]    id:deeplinks.paste.correct-invalid    p1
    Start With No Contacts
    Paste Link    not a link at all
    Wait Until Page Contains Element    ${PASTE_LINK_ERROR}    timeout=10s
    Submit Pasted Link    ${ADD_CONTACT_LINK}
    Wait Until Page Does Not Contain Element    ${PASTE_LINK_INPUT}    timeout=15s
    Wait Until Page Contains Element    ${CONTACT_NAME_INPUT}    timeout=15s
    Input Should Hold    contact_name_input    ${LINK_LABEL}

Link Fired While Locked Waits For The PIN
    [Tags]    id:deeplinks.locked.resumes-after-unlock    p1
    [Setup]    Start On Security
    Require Regular Pin
    Lock By Restart
    Open Deeplink    ${ADD_CONTACT_LINK}
    Sleep    2s    reason=Give the link time to be handled before checking it did not lift the lock.
    Page Should Contain Element    ${PIN_VERIFY_TITLE}
    Unlock With Pin    ${REGULAR_PIN}
    Add Contact Form Should Be Prefilled
    [Teardown]    Turn Pin Off After Test
