*** Settings ***
Documentation       Shared (multisig) accounts on Android and iOS from one suite. Cases that create or
...                 import an account remove it before and after, because accounts outlive the run
...                 and a shared account's address is fixed by its participants.
Resource            ../resources/multisig.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Tags           multisig


*** Variables ***
${NAME_2_OF_3}          Msig 2of3
${NAME_CUSTOM}          Msig Custom
${NAME_1_OF_8}          Msig 1of8
${NAME_ALL_OWN}         Msig All Own
${NAME_SIGNABLE}        Msig Signable
${NAME_IMPORTED}        Msig Imported
${NAME_MANAGED}         Msig Managed
${DEFAULT_NAME}         Shared Account


*** Test Cases ***
Two Of Two Shared Account Is Created With The Default Name
    [Tags]    id:multisig.create.two-of-two    p0    rc
    [Setup]    Remove Account If Present    ${DEFAULT_NAME}
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}
    Open Set Threshold
    Open Before You Create
    Open Name Shared Account
    Finish Account
    Open Shared Account Detail
    Shared Account Detail Count Should Be    2
    Go Home
    Account Menu Should List    ${DEFAULT_NAME}
    [Teardown]    Clean Up Account    ${DEFAULT_NAME}

Two Of Three Shared Account Is Created
    [Tags]    id:multisig.create.two-of-three    p0    rc
    [Setup]    Remove Account If Present    ${NAME_2_OF_3}
    Create Shared Account    ${NAME_2_OF_3}    ${PARTICIPANT_1}    ${PARTICIPANT_2}    ${PARTICIPANT_3}
    Open Shared Account Detail
    Shared Account Detail Count Should Be    3
    [Teardown]    Clean Up Account    ${NAME_2_OF_3}

Introduction Shows Every Time Create Shared Account Is Tapped
    [Tags]    id:multisig.intro.every-time    p1
    Open Create Shared Account
    Go Home
    Open Multisig Introduction

Tapping The Backdrop Dismisses The Introduction
    [Tags]    id:multisig.intro.backdrop-dismiss    p1
    Open Multisig Introduction
    Tap Screen At    0.5    0.08
    Wait Until Page Does Not Contain Element    ${MULTISIG_INTRO_CONTINUE_BUTTON}    timeout=10s
    Page Should Contain Element    ${ADD_ACCOUNT_CREATE_MULTISIG_BUTTON}
    Page Should Not Contain Element    ${ADD_PARTICIPANT_BUTTON}

Go Back On Before You Create Returns To Set Threshold
    [Tags]    id:multisig.confirm.go-back    p1
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}
    Open Set Threshold
    Open Before You Create
    Tap    ${BEFORE_CREATE_GO_BACK_BUTTON}
    Wait Until Page Does Not Contain Element    ${BEFORE_CREATE_PROCEED_BUTTON}    timeout=10s
    Page Should Contain Element    ${SET_THRESHOLD_CONTINUE_BUTTON}
    Page Should Not Contain Element    ${ACCOUNT_FINISH_BUTTON}

Proceed On Before You Create Opens Naming
    [Tags]    id:multisig.confirm.proceed    p1
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}
    Open Set Threshold
    Open Before You Create
    Open Name Shared Account
    Page Should Contain Element    ${ACCOUNT_NAME_INPUT}

Default Name Is Shared Account
    [Tags]    id:multisig.name.default    p1
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}
    Open Set Threshold
    Open Before You Create
    Open Name Shared Account
    ${name}=    Get Text    ${ACCOUNT_NAME_INPUT}
    Should Start With    ${name}    ${DEFAULT_NAME}

Custom Name Is Kept After A Restart
    [Tags]    id:multisig.name.custom    p1
    [Setup]    Remove Account If Present    ${NAME_CUSTOM}
    Create Shared Account    ${NAME_CUSTOM}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Relaunch Pera
    Account Menu Should List    ${NAME_CUSTOM}
    [Teardown]    Clean Up Account    ${NAME_CUSTOM}

Invalid Address Offers No Add
    [Tags]    id:multisig.participant.invalid-address    p2
    Open Create Shared Account
    Open Participant Search
    Input Text    ${ADDRESS_SEARCH_INPUT}    INVALID123
    ${add}=    Test Id    address-search-add-icon
    Page Should Not Contain Element    ${add}
    Clear Text    ${ADDRESS_SEARCH_INPUT}
    Input Text    ${ADDRESS_SEARCH_INPUT}    ${PARTICIPANT_1}
    Wait Until Page Contains Element    ${add}    timeout=10s

Watch Account Is Refused As A Participant
    [Tags]    id:multisig.participant.reject-watch    p1
    Ensure Watch Account
    Go Home
    Open Create Shared Account
    Open Participant Search
    Input Text    ${ADDRESS_SEARCH_INPUT}    ${WATCH_ADDRESS}
    Tap    accessibility_id=account_result_row_${WATCH_ADDRESS}
    Wait Until Page Contains    Cannot add watch account    timeout=10s
    Page Should Not Contain Element    accessibility_id=participant_item_0_${WATCH_ADDRESS}

Shared Account Is Refused As A Participant
    [Tags]    id:multisig.participant.reject-shared    p1
    Open Create Shared Account
    Open Participant Search
    Input Text    ${ADDRESS_SEARCH_INPUT}    ${KNOWN_SHARED_ADDRESS}
    ${add}=    Test Id    address-search-add-icon
    Wait Until Page Contains Element    ${add}    timeout=10s
    Tap    ${add}
    Wait Until Page Contains    Cannot add shared account    timeout=20s
    Page Should Not Contain Element    accessibility_id=participant_item_0_${KNOWN_SHARED_ADDRESS}

Own Participant Can Be Removed
    [Tags]    id:multisig.participant.remove    p1
    Open Create Shared Account
    Add Own Account As Participant
    ${row}=    Test Id Starting With    participant_item_0_
    Wait Until Page Contains Element    ${row}    timeout=10s
    ${remove}=    Test Id Starting With    participant_remove_0_
    Tap    ${remove}
    Wait Until Page Does Not Contain Element    ${row}    timeout=10s

External Participant Opens Edit Name
    [Tags]    id:multisig.participant.edit    p2
    Open Create Shared Account
    Add Participant    ${PARTICIPANT_1}
    Tap    accessibility_id=participant_edit_0_${PARTICIPANT_1}
    Wait Until Page Contains Element    ${EDIT_PARTICIPANT_NAME_INPUT}    timeout=15s

Continue Needs Two Participants
    [Tags]    id:multisig.create.continue-needs-two    p1
    Open Create Shared Account
    Add Participant    ${PARTICIPANT_1}
    Expect Element    ${CREATE_MULTISIG_CONTINUE_BUTTON}    disabled
    Add Participant    ${PARTICIPANT_2}
    Expect Element    ${CREATE_MULTISIG_CONTINUE_BUTTON}    enabled

Same Address Can Fill Two Slots
    [Tags]    id:multisig.participant.duplicate    p1
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_1}
    Participant Should Be Listed    0    ${PARTICIPANT_1}
    Participant Should Be Listed    1    ${PARTICIPANT_1}
    Expect Element    ${CREATE_MULTISIG_CONTINUE_BUTTON}    enabled

At Most Sixteen Participants Can Be Added
    [Tags]    id:multisig.participant.max-sixteen    p1
    Open Create Shared Account
    FOR    ${round}    IN RANGE    4
        Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    END
    Swipe By Percent    50    75    50    30
    Wait Until Page Contains    maximum number of participants    timeout=10s
    Page Should Not Contain Element    ${ADD_PARTICIPANT_BUTTON}

Default Threshold Is Two
    [Tags]    id:multisig.threshold.default    p1
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}    ${PARTICIPANT_3}
    Open Set Threshold
    Participant Count Should Be    3
    Threshold Should Be    2

Threshold Cannot Exceed The Participant Count
    [Tags]    id:multisig.threshold.increment-max    p1
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}    ${PARTICIPANT_3}
    Open Set Threshold
    Tap    ${THRESHOLD_INCREMENT_BUTTON}
    Threshold Should Be    3
    Expect Element    ${THRESHOLD_INCREMENT_BUTTON}    disabled

Threshold Cannot Go Below One
    [Tags]    id:multisig.threshold.decrement-min    p1
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}    ${PARTICIPANT_3}
    Open Set Threshold
    Tap    ${THRESHOLD_DECREMENT_BUTTON}
    Threshold Should Be    1
    Expect Element    ${THRESHOLD_DECREMENT_BUTTON}    disabled

One Of Eight Shared Account Is Created
    [Tags]    id:multisig.create.one-of-eight    p1
    [Setup]    Remove Account If Present    ${NAME_1_OF_8}
    Open Create Shared Account
    Add Participants    ${PARTICIPANT_1}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    ...    ${PARTICIPANT_1}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Open Set Threshold
    Participant Count Should Be    8
    Tap    ${THRESHOLD_DECREMENT_BUTTON}
    Threshold Should Be    1
    Open Before You Create
    Open Name Shared Account
    Enter Account Name    ${NAME_1_OF_8}
    Finish Account
    Open Shared Account Detail
    Shared Account Detail Count Should Be    8
    [Teardown]    Clean Up Account    ${NAME_1_OF_8}

Shared Account Of Only Own Accounts Is Created
    [Tags]    id:multisig.create.all-own    p1
    [Setup]    Remove Account If Present    ${NAME_ALL_OWN}
    Create Shared Account    ${NAME_ALL_OWN}    ${OWN}    ${OWN}
    Open Shared Account Detail
    Shared Account Detail Count Should Be    2
    [Teardown]    Clean Up Account    ${NAME_ALL_OWN}

Shared Account Can Be Selected From The Account Menu
    [Tags]    id:multisig.account.select    p0    rc
    [Setup]    Start With Shared Account    ${NAME_MANAGED}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Open Account Menu
    Click Text    E2E    exact_match=${True}
    Wait Until Page Contains Element    ${MORE_BUTTON}    timeout=15s
    Select Account    ${NAME_MANAGED}
    Open Account Options
    Page Should Contain Element    ${ACCOUNT_OPTION_SHARED_DETAIL}

Shared Account Detail Shows Its Participant Count
    [Tags]    id:multisig.account.detail-m-of-n    p2
    [Setup]    Start With Shared Account    ${NAME_MANAGED}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Open Shared Account Detail
    Shared Account Detail Count Should Be    3

Shared Account Detail Lists Every Participant
    [Tags]    id:multisig.account.detail-participants    p2
    [Setup]    Start With Shared Account    ${NAME_MANAGED}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Open Shared Account Detail
    FOR    ${index}    ${address}    IN ENUMERATE    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
        ${row}=    Test Id    shared_account_participant_${address}_${index}
        Page Should Contain Element    ${row}
    END

Export Opens The Share Sheet
    [Tags]    id:multisig.account.export    p2
    [Setup]    Start With Shared Account    ${NAME_MANAGED}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Open Account Options
    Tap Account Option    ${ACCOUNT_OPTION_EXPORT}
    Wait Until Page Contains    Copy URL    timeout=15s
    Page Should Contain Text    Share URL

Unsignable Shared Account Offers No Rekey
    [Tags]    id:multisig.account.unsignable-no-rekey    p2
    [Setup]    Start With Shared Account    ${NAME_MANAGED}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Open Account Options
    Page Should Contain Element    ${ACCOUNT_TYPE_INFO_BUTTON}
    Page Should Not Contain Element    ${ACCOUNT_OPTION_REKEY}

Removing A Shared Account Takes It Out Of The Wallet
    [Tags]    id:multisig.account.remove    p1
    [Setup]    Start With Shared Account    ${NAME_MANAGED}    ${PARTICIPANT_2}    ${PARTICIPANT_3}    ${PARTICIPANT_4}
    Remove Selected Account
    Open Account Menu
    Page Should Not Contain Text    ${NAME_MANAGED}
    Close Account Menu

Signable Shared Account Rekeys Only To A Shared Account
    [Documentation]    The app routes a shared account straight to the rekey-to-shared intro instead
    ...                of offering the target sheet, so the standard and Ledger rows never appear.
    [Tags]    id:multisig.rekey.shared-only    p1
    [Setup]    Remove Account If Present    ${NAME_SIGNABLE}
    Create Shared Account    ${NAME_SIGNABLE}    ${OWN}    ${PARTICIPANT_1}
    Open Account Options
    Tap Account Option    ${ACCOUNT_OPTION_REKEY}
    Wait Until Page Contains Element    ${REKEY_TO_SHARED_START}    timeout=20s
    Page Should Not Contain Element    ${REKEY_OPTION_STANDARD}
    Page Should Not Contain Element    ${REKEY_OPTION_LEDGER}
    [Teardown]    Clean Up Account    ${NAME_SIGNABLE}

Import Link With An Invalid Address Shows An Error
    [Tags]    id:multisig.import.invalid-address    p2
    Open Deeplink    ${IMPORT_LINK}INVALID_NOT_AN_ALGORAND_ADDRESS
    Wait Until Page Contains Element    ${IMPORT_RETRY_BUTTON}    timeout=20s
    Page Should Not Contain Element    ${IMPORT_ADD_BUTTON}

Import Link Offers A Shared Account The Wallet Is Not Part Of
    [Tags]    id:multisig.import.screen    p0    rc
    [Setup]    Remove Account If Present    ${NAME_IMPORTED}
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    Expect Element    ${IMPORT_ADD_BUTTON}    enabled

Import Screen Lists The Participants
    [Tags]    id:multisig.import.participants    p2
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    ${count}=    Test Id    import-shared-account-participant-count
    ${text}=    Get Text    ${count}
    Should Be Equal As Integers    ${text}    3
    ${row}=    Test Id    import-participant-row-${PARTICIPANT_1}
    Page Should Contain Element    ${row}

Ignoring An Import Adds Nothing
    [Tags]    id:multisig.import.ignore    p1
    [Setup]    Remove Account If Present    ${NAME_IMPORTED}
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    Tap    ${IMPORT_IGNORE_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_SELECTION_BUTTON}    timeout=15s
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    Expect Element    ${IMPORT_ADD_BUTTON}    enabled

Importing Adds The Shared Account
    [Tags]    id:multisig.import.add    p1
    [Setup]    Remove Account If Present    ${NAME_IMPORTED}
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    Add Imported Account    ${NAME_IMPORTED}
    Account Menu Should List    ${NAME_IMPORTED}
    [Teardown]    Clean Up Account    ${NAME_IMPORTED}

Importing An Account Already In The Wallet Is Blocked
    [Tags]    id:multisig.import.duplicate    p1
    [Setup]    Start With Known Shared Account Imported    ${NAME_IMPORTED}
    Open Import Link    ${KNOWN_SHARED_ADDRESS}
    Expect Element    ${IMPORT_ADD_BUTTON}    disabled
    [Teardown]    Clean Up Account    ${NAME_IMPORTED}
