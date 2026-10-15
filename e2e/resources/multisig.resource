*** Settings ***
Resource            app.resource


*** Variables ***
# Public mainnet addresses used as participants; no keys or funds are involved.
${PARTICIPANT_1}                        YMSZFDG4DBNPTTQUYH6WIQ7YEPJGVDGGBHII6JW3C6BAWUN7ENHOAP5BTY
${PARTICIPANT_2}                        O7Y6N65VUJPLIXG6ZHJDY2GBOR3JFDHSGMNYZKQYZHO32MIHBYGLZC2HC4
${PARTICIPANT_3}                        2PO3E4FM2G7RR3FGB7CHQCGF5744CPSMTJ6TQ32F3WJYVNIAIPUBKNRLGU
${PARTICIPANT_4}                        QZNKYCQXYZPPMXSAEADF6QQP5KBXVAMNG3WTSNBOGBG3ISOV2LMSVNSM4M
${WATCH_ADDRESS}                        UUZB34HTTJ6GM2XB44YSL333AWASFH7K3HSAK7R2AOJ4POGUXQSZIUM5XM
# A shared account the backend already knows (participants include PARTICIPANT_1), so it can be
# imported and is refused as a participant.
${KNOWN_SHARED_ADDRESS}                 XUYLM5AGYOJ2JDHUKZVQFSP47K447G54BS36MRAEHSILEMEX2CWW3SHU64
# Stands in for an address in Create Shared Account: add the wallet's own account instead.
${OWN}                                  own
${IMPORT_LINK}                          perawallet://app/shared-account-import/?address=

${ACCOUNT_SELECTION_BUTTON}             accessibility_id=account_selection_button
${ACCOUNT_MENU_ADD_BUTTON}              accessibility_id=account_menu_add_account_button
${MORE_BUTTON}                          accessibility_id=more_button
${ADD_ACCOUNT_CREATE_MULTISIG_BUTTON}   accessibility_id=add_account_create_multisig_button
${ADD_ACCOUNT_SEE_OTHER_OPTIONS}        accessibility_id=add_account_see_other_options_button
${ADD_ACCOUNT_WATCH_BUTTON}             accessibility_id=add_account_watch_button
${WATCH_ADDRESS_INPUT}                  accessibility_id=watch_account_address_input
${WATCH_SUBMIT_BUTTON}                  accessibility_id=watch_account_submit_button

${MULTISIG_INTRO_CONTINUE_BUTTON}       accessibility_id=multisig_introduction_continue_button
${ADD_PARTICIPANT_BUTTON}               accessibility_id=add_participant_button
${CREATE_MULTISIG_CONTINUE_BUTTON}      accessibility_id=create_multisig_continue_button
${ADDRESS_SEARCH_INPUT}                 accessibility_id=address_search_input
${EDIT_PARTICIPANT_NAME_INPUT}          accessibility_id=contact_name_input
${SET_THRESHOLD_CONTINUE_BUTTON}        accessibility_id=set_threshold_continue_button
${THRESHOLD_DECREMENT_BUTTON}           accessibility_id=threshold_decrement_button
${THRESHOLD_INCREMENT_BUTTON}           accessibility_id=threshold_increment_button
${BEFORE_CREATE_PROCEED_BUTTON}         accessibility_id=before_create_proceed_button
${BEFORE_CREATE_GO_BACK_BUTTON}         accessibility_id=before_create_go_back_button

${ACCOUNT_OPTION_COPY_ADDRESS}          accessibility_id=account_option_copy-address
${ACCOUNT_OPTION_SHARED_DETAIL}         accessibility_id=account_option_shared-account-detail
${ACCOUNT_OPTION_EXPORT}                accessibility_id=account_option_export-share-account
${ACCOUNT_OPTION_REKEY}                 accessibility_id=account_option_rekey-account
${ACCOUNT_OPTION_REMOVE}                accessibility_id=account_option_remove-account
${REMOVE_ACCOUNT_CONFIRM_BUTTON}        accessibility_id=remove_account_confirm_button
${ACCOUNT_TYPE_INFO_BUTTON}             accessibility_id=account-type-info-button
${SHARED_ACCOUNT_THRESHOLD}             accessibility_id=shared_account_threshold
${REKEY_TO_SHARED_START}                accessibility_id=rekey-to-shared-intro-start
${REKEY_OPTION_STANDARD}                accessibility_id=rekey_option_standard
${REKEY_OPTION_LEDGER}                  accessibility_id=rekey_option_ledger

${IMPORT_ADD_BUTTON}                    accessibility_id=import-shared-account-add-button
${IMPORT_IGNORE_BUTTON}                 accessibility_id=import-shared-account-ignore-button
${IMPORT_RETRY_BUTTON}                  accessibility_id=import-shared-account-retry

${CREATION_BLOCKED}                     The build cannot register its device (the app showed 'An error occurred': POST /api/v3/devices returned 401, so no deviceId). Rebuild with BACKEND_API_KEY set.


*** Keywords ***
Test Id
    [Documentation]    Locator for a view whose test ID is not its accessibility label: a container,
    ...                or a value whose label is the number it shows. Android exposes that ID as
    ...                resource-id and iOS as name, so one locator covers both.
    [Arguments]    ${id}
    RETURN    xpath=//*[@resource-id='${id}' or @name='${id}']

Test Id Starting With
    [Documentation]    Locator for a labelled view whose ID ends in an address the test cannot know,
    ...                such as the wallet's own account.
    [Arguments]    ${prefix}
    RETURN    xpath=//*[starts-with(@content-desc,'${prefix}') or starts-with(@name,'${prefix}')]

Tap Screen At
    [Documentation]    Taps a point given as fractions of the window, for backdrops with no element.
    [Arguments]    ${x_ratio}    ${y_ratio}
    ${w}=    Get Window Width
    ${h}=    Get Window Height
    Tap With Positions    100ms    ${{(int(${w} * ${x_ratio}), int(${h} * ${y_ratio}))}}

Open Account Menu
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=15s
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Settled    ${ACCOUNT_MENU_ADD_BUTTON}

Close Account Menu
    [Documentation]    The drawer has no close control; tapping the content it uncovers closes it.
    ...                Home is hidden from accessibility while it is open.
    Tap Screen At    0.95    0.5
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=10s

Pick Account In Open Menu
    [Arguments]    ${name}
    Wait Until Page Contains    ${name}    timeout=10s
    Wait Until Keyword Succeeds    3x    0.2s    Click Text    ${name}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=15s

Select Account
    [Arguments]    ${name}
    Open Account Menu
    Pick Account In Open Menu    ${name}

Account Menu Should List
    [Arguments]    ${name}
    Open Account Menu
    Wait Until Page Contains    ${name}    timeout=10s
    Close Account Menu

Open Add Account
    Open Account Menu
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_CREATE_MULTISIG_BUTTON}    timeout=15s

Open Multisig Introduction
    Open Add Account
    Tap    ${ADD_ACCOUNT_CREATE_MULTISIG_BUTTON}
    Wait Until Settled    ${MULTISIG_INTRO_CONTINUE_BUTTON}

Open Create Shared Account
    Open Multisig Introduction
    Tap    ${MULTISIG_INTRO_CONTINUE_BUTTON}
    Wait Until Page Contains Element    ${ADD_PARTICIPANT_BUTTON}    timeout=15s

Open Participant Search
    # A long participant list pushes the button below the fold, where an Android tap misses it.
    ${shown}=    Run Keyword And Return Status    Expect Element    ${ADD_PARTICIPANT_BUTTON}    visible    timeout=0s    loglevel=NONE
    IF    not ${shown}    Swipe By Percent    50    75    50    30
    Tap    ${ADD_PARTICIPANT_BUTTON}
    Wait Until Page Contains Element    ${ADDRESS_SEARCH_INPUT}    timeout=15s

Add Participant
    [Documentation]    The sheet closes only once the app has checked the address remotely.
    [Arguments]    ${address}
    Open Participant Search
    Input Text    ${ADDRESS_SEARCH_INPUT}    ${address}
    ${add}=    Test Id    address-search-add-icon
    Wait Until Page Contains Element    ${add}    timeout=15s
    Tap    ${add}
    Wait Until Page Does Not Contain Element    ${ADDRESS_SEARCH_INPUT}    timeout=20s

Add Own Account As Participant
    [Documentation]    With nothing typed, the search lists the wallet's own eligible accounts.
    Open Participant Search
    ${own}=    Test Id Starting With    account_result_row_
    Wait Until Page Contains Element    ${own}    timeout=15s
    Tap    ${own}
    Wait Until Page Does Not Contain Element    ${ADDRESS_SEARCH_INPUT}    timeout=15s

Add Participants
    [Arguments]    @{addresses}
    FOR    ${address}    IN    @{addresses}
        IF    $address == $OWN
            Add Own Account As Participant
        ELSE
            Add Participant    ${address}
        END
    END

Participant Should Be Listed
    [Arguments]    ${index}    ${address}
    Wait Until Page Contains Element    accessibility_id=participant_item_${index}_${address}    timeout=10s

Open Set Threshold
    Tap    ${CREATE_MULTISIG_CONTINUE_BUTTON}
    Wait Until Page Contains Element    ${SET_THRESHOLD_CONTINUE_BUTTON}    timeout=15s

Threshold Should Be
    [Arguments]    ${expected}
    ${value}=    Test Id    threshold_value
    Wait Until Keyword Succeeds    5s    0.2s    Element Text Should Be    ${value}    ${expected}

Participant Count Should Be
    [Documentation]    On Set Threshold.
    [Arguments]    ${expected}
    ${count}=    Test Id    participant_count_value
    Wait Until Keyword Succeeds    5s    0.2s    Element Text Should Be    ${count}    ${expected}

Open Before You Create
    Tap    ${SET_THRESHOLD_CONTINUE_BUTTON}
    Wait Until Settled    ${BEFORE_CREATE_PROCEED_BUTTON}

Open Name Shared Account
    Tap    ${BEFORE_CREATE_PROCEED_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=15s

Enter Account Name
    [Arguments]    ${name}
    Clear Text    ${ACCOUNT_NAME_INPUT}
    Input Text    ${ACCOUNT_NAME_INPUT}    ${name}
    Dismiss Keyboard

Finish Account
    [Documentation]    Creating or importing registers the account with the backend. A build without
    ...                BACKEND_API_KEY cannot, and says so only in a short-lived toast, so poll for
    ...                it while waiting to leave the name screen and skip rather than blame the app.
    Tap    ${ACCOUNT_FINISH_BUTTON}
    FOR    ${i}    IN RANGE    30
        ${left}=    Run Keyword And Return Status
        ...    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=2s
        IF    ${left}    BREAK
        ${blocked}=    Run Keyword And Return Status    Page Should Contain Text    An error occurred    loglevel=NONE
        Skip If    ${blocked}    ${CREATION_BLOCKED}
    END
    Should Be True    ${left}    Finish did not leave the name screen.
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s

Create Shared Account
    [Documentation]    Creates the account with the default threshold. Pass ${OWN} for the wallet's
    ...                own account. The new account becomes the selected one.
    [Arguments]    ${name}    @{participants}
    Open Create Shared Account
    Add Participants    @{participants}
    Open Set Threshold
    Open Before You Create
    Open Name Shared Account
    Enter Account Name    ${name}
    Finish Account

Open Account Options
    [Documentation]    For the selected account, from Home.
    Tap    ${MORE_BUTTON}
    Wait Until Settled    ${ACCOUNT_OPTION_COPY_ADDRESS}

Tap Account Option
    [Arguments]    ${option}
    # The options sheet scrolls; rows below the fold are off screen on Android.
    ${shown}=    Run Keyword And Return Status    Expect Element    ${option}    visible    timeout=0s    loglevel=NONE
    IF    not ${shown}    Swipe By Percent    50    80    50    40
    Wait Until Settled    ${option}
    Tap    ${option}

Open Shared Account Detail
    Open Account Options
    Tap Account Option    ${ACCOUNT_OPTION_SHARED_DETAIL}
    Wait Until Page Contains Element    ${SHARED_ACCOUNT_THRESHOLD}    timeout=15s

Shared Account Detail Count Should Be
    [Arguments]    ${expected}
    ${count}=    Test Id    shared_account_participant_count
    Wait Until Keyword Succeeds    5s    0.2s    Element Text Should Be    ${count}    ${expected}

Remove Selected Account
    Open Account Options
    Tap Account Option    ${ACCOUNT_OPTION_REMOVE}
    Wait Until Settled    ${REMOVE_ACCOUNT_CONFIRM_BUTTON}
    Tap    ${REMOVE_ACCOUNT_CONFIRM_BUTTON}
    Wait Until Page Does Not Contain Element    ${REMOVE_ACCOUNT_CONFIRM_BUTTON}    timeout=15s

Remove Account If Present
    [Documentation]    Accounts persist across runs and a shared account's address is fixed by its
    ...                participants, so a leftover one would make the next creation a duplicate.
    [Arguments]    ${name}
    Go Home
    Open Account Menu
    ${present}=    Run Keyword And Return Status    Page Should Contain Text    ${name}    loglevel=NONE
    IF    not ${present}
        Close Account Menu
        RETURN
    END
    Pick Account In Open Menu    ${name}
    Remove Selected Account

Clean Up Account
    [Arguments]    ${name}
    Run Keyword If Test Failed    Capture Page Screenshot
    Run Keyword And Ignore Error    Remove Account If Present    ${name}

Start With Shared Account
    [Documentation]    Selects the named shared account, creating it first when it is missing.
    [Arguments]    ${name}    @{participants}
    Go Home
    Open Account Menu
    ${present}=    Run Keyword And Return Status    Page Should Contain Text    ${name}    loglevel=NONE
    IF    ${present}
        Pick Account In Open Menu    ${name}
    ELSE
        Close Account Menu
        Create Shared Account    ${name}    @{participants}
    END

Ensure Watch Account
    [Documentation]    Adds ${WATCH_ADDRESS} as a watch account unless the wallet already holds it,
    ...                in which case the app keeps the submit button disabled.
    Open Add Account
    Tap If Present    ${ADD_ACCOUNT_SEE_OTHER_OPTIONS}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_WATCH_BUTTON}    timeout=15s
    Tap    ${ADD_ACCOUNT_WATCH_BUTTON}
    Wait Until Page Contains    Create a Watch Account    timeout=15s
    Click Text    Create a Watch Account    exact_match=${True}
    Wait Until Page Contains Element    ${WATCH_ADDRESS_INPUT}    timeout=15s
    Input Text    ${WATCH_ADDRESS_INPUT}    ${WATCH_ADDRESS}
    Dismiss Keyboard
    ${new}=    Run Keyword And Return Status
    ...    Expect Element    ${WATCH_SUBMIT_BUTTON}    enabled    timeout=2s    loglevel=NONE
    IF    not ${new}    RETURN
    Tap    ${WATCH_SUBMIT_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=15s
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=30s

Open Import Link
    [Arguments]    ${address}
    Open Deeplink    ${IMPORT_LINK}${address}
    Wait Until Page Contains Element    ${IMPORT_IGNORE_BUTTON}    timeout=20s

Add Imported Account
    [Documentation]    From the import screen.
    [Arguments]    ${name}
    Tap    ${IMPORT_ADD_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=15s
    Enter Account Name    ${name}
    Finish Account

Start With Known Shared Account Imported
    [Arguments]    ${name}
    Go Home
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    ${new}=    Run Keyword And Return Status
    ...    Expect Element    ${IMPORT_ADD_BUTTON}    enabled    timeout=2s    loglevel=NONE
    IF    ${new}    Add Imported Account    ${name}
    Go Home
