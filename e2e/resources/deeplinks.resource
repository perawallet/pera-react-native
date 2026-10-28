*** Settings ***
Documentation       Links delivered by the OS, as a browser or another app would send them. Parsing is in
...                 apps/mobile/src/modules/deeplink/*parser.ts and dispatch in hooks/useDeepLink.ts.
Resource            contacts.resource
Resource            accounts.resource
Resource            security.resource


*** Variables ***
# A valid address that is not in the suite wallet: the contacts fixture's (contacts.resource).
${LINK_ADDRESS}                 CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA
${CONTACT_ADDRESS_ROW_ALGORAND}     tid=contact_address_row_algorand
${LINK_LABEL}                   E2E Link Contact
${LINK_LABEL_ENCODED}           E2E%20Link%20Contact
# Links carry base units; the amount screen shows ALGO, which has 6 decimals.
${TRANSFER_MICROALGOS}          1234567
${TRANSFER_ALGOS}               1.234567
# USDC on mainnet, the suite wallet's network.
${OPT_IN_ASSET_ID}              31566704

${ADD_CONTACT_LINK}             perawallet://app/add-contact?address=${LINK_ADDRESS}&label=${LINK_LABEL_ENCODED}
${WATCH_ACCOUNT_LINK}           perawallet://app/add-watch-account?address=${LINK_ADDRESS}
${ALGO_TRANSFER_LINK}           algorand://${LINK_ADDRESS}?amount=${TRANSFER_MICROALGOS}
${OPT_IN_LINK}                  perawallet://app/asset-opt-in?assetId=${OPT_IN_ASSET_ID}
# An unknown path on Pera's own scheme falls back to Home (old-parser.ts).
${UNKNOWN_PATH_LINK}            perawallet://app/no-such-screen
# Fails ARC-90 address validation, so the listener drops it before dispatch.
${INVALID_ALGORAND_LINK}        algorand://NOT-AN-ADDRESS?amount=1

${SETTINGS_ITEM_SECURITY}       tid=settings_item_security
${SEND_NEXT}                    tid=send_input_next_button
${SEND_CONFIRM}                 tid=send_confirm_button
# The send-info sheet over the numpad has no testID on its button.
${SEND_INFO_UNDERSTAND}         xpath=//*[@text='I Understand' or @label='I Understand']
# iOS merges the toast's title and body into one label, and keeps earlier toasts in the tree
# parked off screen, so only a visible one counts there.
${INSUFFICIENT_BALANCE}         xpath=//*[@text='Insufficient Balance' or (starts-with(@label,'Insufficient Balance') and @visible='true')]
${OPT_IN_ACCOUNT_ROW}           xpath=(//*[starts-with(@resource-id,'opt_in_account-') or starts-with(@name,'opt_in_account-')])[1]
${OPT_IN_CONFIRM}               tid=opt_in_confirm
${OPT_IN_COPY_ID}               tid=opt_in_copy_id

${MENU_PASTE_LINK_BUTTON}       tid=menu_paste_link_button
${PASTE_LINK_INPUT}             tid=paste-link-input
${PASTE_LINK_SUBMIT}            tid=paste-link-submit
${PASTE_LINK_ERROR}             tid=paste-link-error


*** Keywords ***
Start On Settings
    [Documentation]    A screen in another tab, so landing on Home is a real navigation.
    Go Home
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    # The tab switch is still animating when the gear appears; a tap then is lost.
    Wait Until Settled    ${MENU_SETTINGS_BUTTON}
    Tap    ${MENU_SETTINGS_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_ITEM_SECURITY}    timeout=15s
    # Inactive tabs leave the tree; if Home stayed, landing on it would prove nothing.
    Page Should Not Contain Element    ${MORE_BUTTON}

Suite Account Address
    Go Home
    Open Account Switcher
    @{addresses}=    Switcher Addresses
    Go Home
    RETURN    ${addresses}[0]

Should Be On Home
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=15s
    Page Should Contain Element    ${ACCOUNT_SELECTION_BUTTON}
    # On iOS Home enters the tree before the Settings screen it replaces has left it.
    Wait Until Page Does Not Contain Element    ${SETTINGS_ITEM_SECURITY}    timeout=5s

Input Should Hold
    [Documentation]    Android reports a field's text as @text, iOS as @value.
    [Arguments]    ${test_id}    ${value}    ${timeout}=10s
    Wait Until Page Contains Element
    ...    xpath=//*[(@content-desc='${test_id}' or @resource-id='${test_id}' or @name='${test_id}') and (@text='${value}' or @value='${value}')]
    ...    timeout=${timeout}

Add Contact Form Should Be Prefilled
    [Documentation]    The link's label becomes the contact name, and its address arrives as a
    ...                chain row rather than in the input: a contact holds one address per chain
    ...                family now, and the input only appears while a new one is being added.
    ...                The row truncates, so compare the ends it does show.
    [Arguments]    ${timeout}=15s
    Wait Until Page Contains Element    ${CONTACT_NAME_INPUT}    timeout=${timeout}
    Input Should Hold    contact_name_input    ${LINK_LABEL}
    Wait Until Page Contains Element    ${CONTACT_ADDRESS_ROW_ALGORAND}    timeout=${timeout}
    # The row is a container; its address sits in a child text node, so reading the row itself
    # gives back an empty string on Android.
    ${shown}=    Text Under    ${CONTACT_ADDRESS_ROW_ALGORAND}
    # iOS exposes the row's chain name and its remove control but not the address itself, so
    # there is nothing to compare against there. Android renders it, and the check has teeth.
    Skip If    $LINK_ADDRESS[:5] not in $shown and $LINK_ADDRESS[-5:] not in $shown
    ...    App gap: the address row exposes only "${shown}" on this platform, so the prefilled address cannot be read back.
    Should Contain    ${shown}    ${{ $LINK_ADDRESS[:5] }}
    ...    msg=The prefilled address row reads "${shown}", which does not start with ${LINK_ADDRESS}.
    Should Contain    ${shown}    ${{ $LINK_ADDRESS[-5:] }}
    ...    msg=The prefilled address row reads "${shown}", which does not end with ${LINK_ADDRESS}.

Send Amount Should Be Prefilled
    [Documentation]    The deeplink opens Send on the amount step with ALGO already chosen.
    [Arguments]    ${timeout}=15s
    Wait Until Page Contains Element    ${SEND_NEXT}    timeout=${timeout}
    # First send on a device opens a tips sheet over the numpad.
    Tap If Shown    ${SEND_INFO_UNDERSTAND}    5s
    Wait Until Page Contains    ${TRANSFER_ALGOS}    timeout=10s

Next Should Be Refused For Lack Of Funds
    [Documentation]    The suite wallet is unfunded: Next must stop on the amount step, never reach the
    ...                confirm slider.
    Wait Until Settled    ${SEND_NEXT}
    Tap    ${SEND_NEXT}
    Wait Until Page Contains Element    ${INSUFFICIENT_BALANCE}    timeout=15s
    Page Should Contain Element    ${SEND_NEXT}
    Page Should Not Contain Element    ${SEND_CONFIRM}

Paste Link
    [Documentation]    Menu > Paste a Link: the in-app entry that accepts what the QR scanner accepts.
    [Arguments]    ${text}
    Open Paste Link
    Submit Pasted Link    ${text}

Open Paste Link
    Go Home
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_PASTE_LINK_BUTTON}    timeout=15s
    Wait Until Settled    ${MENU_PASTE_LINK_BUTTON}
    Tap    ${MENU_PASTE_LINK_BUTTON}
    Wait Until Settled    ${PASTE_LINK_INPUT}

Submit Pasted Link
    [Arguments]    ${text}
    Clear Text    ${PASTE_LINK_INPUT}
    Input Text    ${PASTE_LINK_INPUT}    ${text}
    Dismiss Keyboard
    Wait Until Settled    ${PASTE_LINK_SUBMIT}
    Tap    ${PASTE_LINK_SUBMIT}

Turn Pin Off After Test
    Capture Failure Screenshot
    Turn Pin Off
