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
# Shared accounts this suite created, by name. iOS hides an account row's name inside its
# accessible row, so accounts are found by address (the row's test ID) instead.
&{CREATED}
${IMPORT_LINK}                          perawallet://app/shared-account-import/?address=

${ACCOUNT_SELECTION_BUTTON}             xpath=//*[@resource-id='account_selection_button' or @name='account_selection_button' or @content-desc='account_selection_button']
${ACCOUNT_ROW_PREFIX}                   account_switcher_row_
${PARTICIPANT_ROW_ANY}                  xpath=//*[starts-with(@resource-id,'participant_item_') or starts-with(@name,'participant_item_') or starts-with(@content-desc,'participant_item_')]
# Above this many rows the list scrolls and the ones off screen are not in the tree.
${PARTICIPANT_ROWS_ALL_VISIBLE}             ${6}
${ACCOUNT_MENU_ADD_BUTTON}              xpath=//*[@resource-id='account_menu_add_account_button' or @name='account_menu_add_account_button' or @content-desc='account_menu_add_account_button']
${MORE_BUTTON}                          xpath=//*[@resource-id='more_button' or @name='more_button' or @content-desc='more_button']
${ADD_ACCOUNT_CREATE_MULTISIG_BUTTON}   xpath=//*[@resource-id='add_account_create_multisig_button' or @name='add_account_create_multisig_button' or @content-desc='add_account_create_multisig_button']
${ADD_ACCOUNT_SEE_OTHER_OPTIONS}        xpath=//*[@resource-id='add_account_see_other_options_button' or @name='add_account_see_other_options_button' or @content-desc='add_account_see_other_options_button']
${ADD_ACCOUNT_WATCH_BUTTON}             xpath=//*[@resource-id='add_account_watch_button' or @name='add_account_watch_button' or @content-desc='add_account_watch_button']
${WATCH_ADDRESS_INPUT}                  xpath=//*[@resource-id='watch_account_address_input' or @name='watch_account_address_input' or @content-desc='watch_account_address_input']
${WATCH_SUBMIT_BUTTON}                  xpath=//*[@resource-id='watch_account_submit_button' or @name='watch_account_submit_button' or @content-desc='watch_account_submit_button']

${MULTISIG_INTRO_CONTINUE_BUTTON}       xpath=//*[@resource-id='multisig_introduction_continue_button' or @name='multisig_introduction_continue_button' or @content-desc='multisig_introduction_continue_button']
${ADD_PARTICIPANT_BUTTON}               xpath=//*[@resource-id='add_participant_button' or @name='add_participant_button' or @content-desc='add_participant_button']
${CREATE_MULTISIG_CONTINUE_BUTTON}      xpath=//*[@resource-id='create_multisig_continue_button' or @name='create_multisig_continue_button' or @content-desc='create_multisig_continue_button']
${ADDRESS_SEARCH_INPUT}                 xpath=//*[@resource-id='address_search_input' or @name='address_search_input' or @content-desc='address_search_input']
${EDIT_PARTICIPANT_NAME_INPUT}          xpath=//*[@resource-id='contact_name_input' or @name='contact_name_input' or @content-desc='contact_name_input']
${SET_THRESHOLD_CONTINUE_BUTTON}        xpath=//*[@resource-id='set_threshold_continue_button' or @name='set_threshold_continue_button' or @content-desc='set_threshold_continue_button']
${THRESHOLD_DECREMENT_BUTTON}           xpath=//*[@resource-id='threshold_decrement_button' or @name='threshold_decrement_button' or @content-desc='threshold_decrement_button']
${THRESHOLD_INCREMENT_BUTTON}           xpath=//*[@resource-id='threshold_increment_button' or @name='threshold_increment_button' or @content-desc='threshold_increment_button']
${BEFORE_CREATE_PROCEED_BUTTON}         xpath=//*[@resource-id='before_create_proceed_button' or @name='before_create_proceed_button' or @content-desc='before_create_proceed_button']
${BEFORE_CREATE_GO_BACK_BUTTON}         xpath=//*[@resource-id='before_create_go_back_button' or @name='before_create_go_back_button' or @content-desc='before_create_go_back_button']

${ACCOUNT_OPTION_COPY_ADDRESS}          xpath=//*[@resource-id='account_network_algorand_copy' or @name='account_network_algorand_copy' or @content-desc='account_network_algorand_copy']
${ACCOUNT_ALGORAND_EXPAND}              xpath=//*[@resource-id='account_network_algorand_expand' or @name='account_network_algorand_expand' or @content-desc='account_network_algorand_expand']
${ACCOUNT_OPTION_SHARED_DETAIL}         xpath=//*[@resource-id='account_option_shared-account-detail' or @name='account_option_shared-account-detail' or @content-desc='account_option_shared-account-detail']
${ACCOUNT_OPTION_EXPORT}                xpath=//*[@resource-id='account_option_export-share-account' or @name='account_option_export-share-account' or @content-desc='account_option_export-share-account']
${ACCOUNT_OPTION_REKEY}                 xpath=//*[@resource-id='account_option_rekey-account' or @name='account_option_rekey-account' or @content-desc='account_option_rekey-account']
${ACCOUNT_OPTION_REMOVE}                xpath=//*[@resource-id='account_option_remove-account' or @name='account_option_remove-account' or @content-desc='account_option_remove-account']
${REMOVE_ACCOUNT_CONFIRM_BUTTON}        xpath=//*[@resource-id='remove_account_confirm_button' or @name='remove_account_confirm_button' or @content-desc='remove_account_confirm_button']
${ACCOUNT_TYPE_INFO_BUTTON}             xpath=//*[@resource-id='account-type-info-button' or @name='account-type-info-button' or @content-desc='account-type-info-button']
${SHARED_ACCOUNT_THRESHOLD}             xpath=//*[@resource-id='shared_account_threshold' or @name='shared_account_threshold' or @content-desc='shared_account_threshold']
${REKEY_TO_SHARED_START}                xpath=//*[@resource-id='rekey-to-shared-intro-start' or @name='rekey-to-shared-intro-start' or @content-desc='rekey-to-shared-intro-start']
${REKEY_OPTION_STANDARD}                xpath=//*[@resource-id='rekey_option_standard' or @name='rekey_option_standard' or @content-desc='rekey_option_standard']
${REKEY_OPTION_LEDGER}                  xpath=//*[@resource-id='rekey_option_ledger' or @name='rekey_option_ledger' or @content-desc='rekey_option_ledger']

${IMPORT_ADD_BUTTON}                    xpath=//*[@resource-id='import-shared-account-add-button' or @name='import-shared-account-add-button' or @content-desc='import-shared-account-add-button']
${IMPORT_IGNORE_BUTTON}                 xpath=//*[@resource-id='import-shared-account-ignore-button' or @name='import-shared-account-ignore-button' or @content-desc='import-shared-account-ignore-button']
# The import screen once its lookup has answered: the account, or the error state.
${IMPORT_LOADED}                        xpath=//*[@name='import-shared-account-ignore-button' or @content-desc='import-shared-account-ignore-button' or @resource-id='import-shared-account-ignore-button' or @name='import-shared-account-retry' or @content-desc='import-shared-account-retry' or @resource-id='import-shared-account-retry']

${CREATION_BLOCKED}                     The build cannot register its device (the app showed 'An error occurred': POST /api/v4/devices/ returned 401, so no deviceId). Rebuild with BACKEND_API_KEY set.


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
    RETURN    xpath=//*[starts-with(@content-desc,'${prefix}') or starts-with(@resource-id, '${prefix}') or starts-with(@name,'${prefix}')]

Tap Screen At
    [Documentation]    Taps a point given as fractions of the window, for backdrops with no element.
    [Arguments]    ${x_ratio}    ${y_ratio}
    ${w}=    Get Window Width
    ${h}=    Get Window Height
    Tap With Positions    100ms    ${{(int(${w} * ${x_ratio}), int(${h} * ${y_ratio}))}}

Open Account Menu
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=15s
    # The menu's rows stay in the Android tree while it is closed, and its buttons hold still
    # until the spring starts, so neither presence nor a settled position proves it opened. Home
    # moving aside (or, on iOS, hiding) does. A tap while Home re-renders after a reset opens
    # nothing, so the header is tapped once more when Home has not moved.
    FOR    ${attempt}    IN RANGE    2
        Tap    ${ACCOUNT_SELECTION_BUTTON}
        ${open}=    Run Keyword And Return Status    Wait Until Keyword Succeeds    3s    0.1s
        ...    Home Should Be Pushed Aside
        IF    ${open}    BREAK
    END
    Should Be True    ${open}    The account menu did not open.
    Wait Until Settled    ${ACCOUNT_MENU_ADD_BUTTON}

Home Should Be Pushed Aside
    ${home}=    Test Id    pw_drawer_content
    ${status}    ${location}=    Run Keyword And Ignore Error    Get Element Location    ${home}
    IF    $status == 'FAIL'    RETURN
    Should Be True    ${location}[x] > 0

Close Account Menu
    [Documentation]    The drawer has no close control; tapping the content it uncovers closes it.
    Tap Screen At    0.95    0.5
    Wait Until Account Menu Closed

Wait Until Account Menu Closed
    [Documentation]    Android keeps a closed menu's rows in the tree, so presence proves nothing;
    ...                the menu is closed once Home is back at the left edge.
    ${home}=    Test Id    pw_drawer_content
    Wait Until Keyword Succeeds    5s    0.1s    Home Should Be Back    ${home}

Home Should Be Back
    [Arguments]    ${home}
    ${location}=    Get Element Location    ${home}
    Should Be Equal As Integers    ${location}[x]    0

Accounts In Open Menu
    [Documentation]    Addresses of the wallet's accounts, read from the account rows' test IDs.
    ...
    ...                Get Webelements raises when nothing matches rather than returning an empty
    ...                list, and this runs in Suite Setup: one switcher that had not finished
    ...                drawing its rows failed every case in the suite. Wait for the first row,
    ...                and hand back an empty list if none arrives - the callers compare lists and
    ...                say what they expected.
    ${prefix}=    Test Id Starting With    ${ACCOUNT_ROW_PREFIX}
    ${listed}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${prefix}    timeout=15s
    IF    not ${listed}
        Log    The account switcher lists no rows; returning no addresses.    level=WARN
        RETURN    ${{ [] }}
    END
    ${rows}=    Get Webelements    ${prefix}
    VAR    @{addresses}
    FOR    ${row}    IN    @{rows}
        ${id}=    Get Test ID    ${row}
        VAR    @{addresses}    @{addresses}    ${{ $id.replace($ACCOUNT_ROW_PREFIX, '') }}
    END
    RETURN    ${addresses}

Pick Account In Open Menu
    [Arguments]    ${address}
    Tap    xpath=//*[@resource-id='${ACCOUNT_ROW_PREFIX}${address}' or @name='${ACCOUNT_ROW_PREFIX}${address}' or @content-desc='${ACCOUNT_ROW_PREFIX}${address}']
    Wait Until Account Menu Closed

Select Account
    [Arguments]    ${address}
    Open Account Menu
    Pick Account In Open Menu    ${address}

Account Name Should Be
    [Documentation]    The account options sheet is titled with the account's name on both platforms.
    [Arguments]    ${address}    ${name}
    Select Account    ${address}
    Open Account Options
    Wait Until Page Contains    ${name}    timeout=5s
    Close Sheet
    Wait Until Page Does Not Contain Element    ${ACCOUNT_OPTION_COPY_ADDRESS}    timeout=10s

Open Add Account
    [Documentation]    Returns the addresses the wallet held before, so a creation can find its account.
    Open Account Menu
    ${accounts}=    Accounts In Open Menu
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_CREATE_MULTISIG_BUTTON}    timeout=15s
    RETURN    ${accounts}

Open Multisig Introduction
    ${accounts}=    Open Add Account
    Tap    ${ADD_ACCOUNT_CREATE_MULTISIG_BUTTON}
    Wait Until Settled    ${MULTISIG_INTRO_CONTINUE_BUTTON}
    RETURN    ${accounts}

Open Create Shared Account
    ${accounts}=    Open Multisig Introduction
    Tap    ${MULTISIG_INTRO_CONTINUE_BUTTON}
    Wait Until Page Contains Element    ${ADD_PARTICIPANT_BUTTON}    timeout=15s
    RETURN    ${accounts}

Register New Account
    [Documentation]    Records, under ${name}, the address that joined the wallet since ${before} was
    ...                read, and returns it.
    [Arguments]    ${name}    ${before}
    Open Account Menu
    ${after}=    Accounts In Open Menu
    Close Account Menu
    ${new}=    Evaluate    [a for a in $after if a not in $before]
    Length Should Be    ${new}    1    Expected exactly one new account, found ${new}.
    Set To Dictionary    ${CREATED}    ${name}=${new}[0]
    RETURN    ${new}[0]

Clean Up Test Accounts
    [Documentation]    Test Teardown. Removes the accounts the case created, except those named in
    ...                @{keep}, so the menu stays short enough to show every row: its list renders
    ...                only the rows in view.
    [Arguments]    @{keep}
    Capture Failure Screenshot
    FOR    ${name}    IN    @{{ [n for n in $CREATED if n not in $keep] }}
        ${address}=    Evaluate    $CREATED.pop($name)
        Run Keyword And Ignore Error    Remove Account    ${address}
    END

Remove Account
    [Arguments]    ${address}
    Go Home
    Open Account Menu
    ${present}=    Run Keyword And Return Status
    ...    Page Should Contain Element    xpath=//*[@resource-id='${ACCOUNT_ROW_PREFIX}${address}' or @name='${ACCOUNT_ROW_PREFIX}${address}' or @content-desc='${ACCOUNT_ROW_PREFIX}${address}']
    IF    not ${present}
        Close Account Menu
        RETURN
    END
    Pick Account In Open Menu    ${address}
    Remove Selected Account

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
    Wait Until Participant Sheet Closed    20s

Add Own Account As Participant
    [Documentation]    With nothing typed, the search lists the wallet's own eligible accounts.
    Open Participant Search
    ${own}=    Test Id Starting With    account_result_row_
    Wait Until Page Contains Element    ${own}    timeout=15s
    Tap    ${own}
    Wait Until Participant Sheet Closed    15s

Wait Until Participant Sheet Closed
    [Documentation]    The search input goes as soon as the sheet starts closing; a tap before its
    ...                backdrop is gone lands on the backdrop.
    [Arguments]    ${timeout}
    Wait Until Page Does Not Contain Element    ${ADDRESS_SEARCH_INPUT}    timeout=${timeout}
    Wait Until Page Does Not Contain Element    ${SHEET_BACKDROP}    timeout=10s

Add Participants
    [Documentation]    Onto an empty Create Shared Account list.
    [Arguments]    @{addresses}
    FOR    ${address}    IN    @{addresses}
        ${before}=    Participant Row Count
        IF    $address == $OWN
            Add Own Account As Participant
        ELSE
            Add Participant    ${address}
        END
        # The row is added only after the sheet has closed, and Continue stays disabled until the
        # second one is; a tap before then does nothing.
        #
        # Wait for the list to GROW, not for participant_item_<argument position>: the
        # max-participants case calls this four times over, so on the second call the positions
        # start at 0 again while the ids carry 4..7. The own-account branch has no address to
        # match on either.
        #
        # Only while the list still fits on screen, though. The count comes from the rendered
        # rows, and once the list scrolls the ones above the fold leave the tree - so a growing
        # list stops looking like one. Past that the closed sheet is the signal that the add
        # landed, and the case's own assertions cover the rest.
        IF    ${before} < ${PARTICIPANT_ROWS_ALL_VISIBLE}
            Wait Until Keyword Succeeds    10s    0.5s    Participant Count Should Exceed    ${before}
        END
    END

Participant Should Be Listed
    [Arguments]    ${index}    ${address}
    Wait Until Page Contains Element    xpath=//*[@resource-id='participant_item_${index}_${address}' or @name='participant_item_${index}_${address}' or @content-desc='participant_item_${index}_${address}']    timeout=10s

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
    # The name field takes focus on arrival and the keyboard lifts the button; a tap while it
    # rises misses.
    Wait Until Settled    ${ACCOUNT_FINISH_BUTTON}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    # Poll fast. The toast is short-lived, and a two-second gap between looks let it come and
    # go unseen: the same blocked build then reported SKIP on one run and "Finish did not leave
    # the name screen" on the next, which made the suite's own results untrustworthy.
    VAR    ${left}    ${False}
    VAR    ${blocked}    ${False}
    FOR    ${i}    IN RANGE    120
        ${left}=    Run Keyword And Return Status
        ...    Page Should Not Contain Element    ${ACCOUNT_FINISH_BUTTON}
        IF    ${left}    BREAK
        ${toast}=    Run Keyword And Return Status
        ...    Page Should Contain Text    An error occurred    loglevel=NONE
        IF    ${toast}    VAR    ${blocked}    ${True}
        IF    ${blocked}    BREAK
        Sleep    0.5s
    END
    Skip If    ${blocked}    ${CREATION_BLOCKED}
    Should Be True    ${left}
    ...    msg=Finish did not leave the name screen in 60s, and no backend error was shown either - so this is neither the known device-registration block nor a slow save.
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=30s

Create Shared Account
    [Documentation]    Creates the account with the default threshold and returns its address. Pass
    ...                ${OWN} for the wallet's own account. The new account becomes the selected one.
    [Arguments]    ${name}    @{participants}
    ${before}=    Open Create Shared Account
    Add Participants    @{participants}
    Open Set Threshold
    Open Before You Create
    Open Name Shared Account
    Enter Account Name    ${name}
    Finish Account
    ${address}=    Register New Account    ${name}    ${before}
    RETURN    ${address}

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

Expand Algorand Network
    [Documentation]    Rekey sits in the Algorand network row, behind its chevron.
    Tap Account Option    ${ACCOUNT_ALGORAND_EXPAND}

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

Start From Wallet Account Only
    [Documentation]    Suite Setup. Accounts outlive a run and a shared account's address is fixed by
    ...                its participants, so a leftover one would turn the next creation into a
    ...                duplicate. Any account beyond the wallet's own means a reset.
    Start Pera With Wallet
    Open Account Menu
    ${accounts}=    Accounts In Open Menu
    Close Account Menu
    ${count}=    Get Length    ${accounts}
    IF    ${count} > 1    Reset To Fresh Wallet

Start With Shared Account
    [Documentation]    Selects the named shared account, creating it first when this run has not.
    [Arguments]    ${name}    @{participants}
    Go Home
    ${address}=    Evaluate    $CREATED.get($name)
    IF    $address
        Open Account Menu
        ${present}=    Run Keyword And Return Status
        ...    Page Should Contain Element    xpath=//*[@resource-id='${ACCOUNT_ROW_PREFIX}${address}' or @name='${ACCOUNT_ROW_PREFIX}${address}' or @content-desc='${ACCOUNT_ROW_PREFIX}${address}']
        IF    ${present}
            Pick Account In Open Menu    ${address}
            RETURN    ${address}
        END
        Close Account Menu
    END
    ${address}=    Create Shared Account    ${name}    @{participants}
    RETURN    ${address}

Ensure Watch Account
    [Documentation]    Adds ${WATCH_ADDRESS} as a watch account unless the wallet already holds it,
    ...                in which case the app keeps the submit button disabled.
    Open Add Account
    Tap If Present    ${ADD_ACCOUNT_SEE_OTHER_OPTIONS}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_WATCH_BUTTON}    timeout=15s
    # The option opens at the bottom edge, partly under the system navigation bar that takes the tap.
    Swipe By Percent    50    70    50    40
    Wait Until Settled    ${ADD_ACCOUNT_WATCH_BUTTON}
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
    Wait Until Settled    ${ACCOUNT_FINISH_BUTTON}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    Wait Until Page Does Not Contain Element    ${ACCOUNT_FINISH_BUTTON}    timeout=30s

Open Import Link
    [Arguments]    ${address}
    Open Deeplink    ${IMPORT_LINK}${address}
    Wait Until Page Contains Element    ${IMPORT_LOADED}    timeout=20s
    ${known}=    Run Keyword And Return Status    Page Should Contain Element    ${IMPORT_IGNORE_BUTTON}
    Skip If    not ${known}
    ...    The backend returned no shared account for ${address}: the import screen shows its error state, so there is nothing to import.

Add Imported Account
    [Documentation]    From the import screen.
    [Arguments]    ${name}
    Tap    ${IMPORT_ADD_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_FINISH_BUTTON}    timeout=15s
    Enter Account Name    ${name}
    Finish Account
    Set To Dictionary    ${CREATED}    ${name}=${KNOWN_SHARED_ADDRESS}

Start With Known Shared Account Imported
    [Arguments]    ${name}
    Go Home
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    ${new}=    Run Keyword And Return Status
    ...    Expect Element    ${IMPORT_ADD_BUTTON}    enabled    timeout=2s    loglevel=NONE
    IF    ${new}    Add Imported Account    ${name}
    Go Home

Participant Row Count
    [Documentation]    How many participant rows the list is showing.
    ${rows}=    Run Keyword And Return Status    Page Should Contain Element    ${PARTICIPANT_ROW_ANY}
    IF    not ${rows}    RETURN    ${0}
    @{found}=    Get WebElements    ${PARTICIPANT_ROW_ANY}
    RETURN    ${{ len($found) }}

Participant Count Should Exceed
    [Arguments]    ${before}
    ${now}=    Participant Row Count
    Should Be True    ${now} > ${before}
    ...    msg=The participant list still shows ${now} rows, so the one just added did not land.
