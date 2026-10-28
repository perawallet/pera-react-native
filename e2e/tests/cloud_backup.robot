*** Settings ***
Documentation       Cloud Backup on Android and iOS from one suite. Each case walks to its own starting
...                 point (choice screen, passphrase, quiz, store-key or overview), turning an existing
...                 backup off or activating one as needed, so any case runs alone. Fund-free.
...                 Cases tagged needs-backend need a build carrying BACKEND_API_KEY and skip unless
...                 PERA_E2E_BACKEND_KEYED is set.
Resource            ../resources/cloud_backup.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           cloud-backup


*** Test Cases ***
Intro Lists The Steps And Continues To The Choice
    [Documentation]    The intro shows only until it is first continued past; afterwards the row opens
    ...                the choice screen directly, so this skips on a device that has seen it.
    [Tags]    id:cloud-backup.entry.intro    p1    env-limited
    Open Cloud Backup
    ${intro}=    Run Keyword And Return Status    Page Should Contain Element    ${CB_INTRO_SCREEN}
    Skip If    not ${intro}    The Cloud Backup intro was already seen on this device.
    Page Should Contain Element    ${CB_INTRO_STEPS}
    Tap    ${CB_INTRO_CONTINUE}
    Wait Until Page Contains Element    ${CB_SETUP_OPTION}    timeout=20s

Choice Offers Both Set Up And Restore
    [Tags]    id:cloud-backup.choice.options    p1
    Start At Choice
    Page Should Contain Element    ${CB_SCREEN}
    Page Should Contain Element    ${CB_RESTORE_OPTION}
    ...    message=The restore route is missing, stranding anyone with an existing backup.

Every Encryption Passphrase Word Is Readable
    [Documentation]    The id sits on the grid cell, whose own text is empty. If it moved onto the word's
    ...                PWText, getTestProps would overwrite the word with the id and every cell would
    ...                read back as an id while the screen still looks right.
    [Tags]    id:cloud-backup.setup.passphrase-readable    p1
    Start At Setup Passphrase
    @{words}=    Read Passphrase
    Length Should Be    ${words}    12
    ...    msg=The encryption passphrase did not render 12 words; a partial key cannot decrypt the backup.
    FOR    ${w}    IN    @{words}
        Should Match Regexp    ${w}    ^[a-z]+$
        ...    msg=Passphrase cell reads "${w}", not a word: the cell exposes an id, a number or nothing.
    END

Proceed Stays Disabled Until The Passphrase Is Acknowledged
    [Tags]    id:cloud-backup.setup.proceed-gated    p2    integration-covered
    Start At Setup Passphrase
    Should Be Enabled    ${CB_SETUP_PROCEED}    false
    ...    Proceed was enabled before the "I saved it" checkbox was ticked.

Acknowledging The Passphrase Unlocks Proceed To The Quiz
    [Tags]    id:cloud-backup.setup.acknowledge    p2    integration-covered
    Start At Setup Passphrase
    Acknowledge Passphrase
    Should Be Enabled    ${CB_SETUP_PROCEED}    true
    ...    Proceed stayed disabled after the acknowledgement checkbox was ticked.
    Tap    ${CB_SETUP_PROCEED}
    Wait Until Page Contains Element    ${CB_VERIFY_SCREEN}    timeout=20s

Verify Quiz Asks For Words And Gates Proceed
    [Documentation]    Without the before-state, "enabled after answering" would also pass on a build
    ...                whose Proceed is always enabled.
    [Tags]    id:cloud-backup.verify.gated    p1
    Start At Verify Quiz
    Should Be Enabled    ${CB_VERIFY_PROCEED}    false
    ...    The verify Proceed button was enabled before any word was chosen.
    FOR    ${i}    IN RANGE    ${CB_QUIZ_ITEMS}
        ${item}=    Quiz Item    ${i}
        Swipe Until In View    ${item}
        Asked Word Position    ${i}
    END

Answering Every Word Correctly Unlocks Proceed
    [Tags]    id:cloud-backup.verify.correct    p2    integration-covered
    @{words}=    Start At Verify Quiz
    Answer Verify Quiz    ${words}
    Should Be Enabled    ${CB_VERIFY_PROCEED}    true
    ...    Proceed stayed disabled after every word was answered from the passphrase the app showed.

A Wrong Word Is Refused On Submit
    [Documentation]    Proceed is enabled once every item has an answer, right or wrong; correctness is
    ...                checked on submit. The toast is the positive proof: "still on verify" alone also
    ...                describes a submit that never fired. Refused before registration, so this
    ...                needs no backend key.
    [Tags]    id:cloud-backup.verify.wrong-word    p1
    @{words}=    Start At Verify Quiz
    ${wrong}=    Answer Verify Quiz    ${words}    wrong_index=0
    Tap    ${CB_VERIFY_PROCEED}
    Wait Until Page Contains Element    ${CB_VERIFY_WRONG_TOAST}    timeout=5s
    ...    error=Submitting the wrong word "${wrong}" showed no "Incorrect selection" feedback.
    Page Should Contain Element    ${CB_VERIFY_SCREEN}
    ...    message=Submitting the wrong word "${wrong}" left the verify screen.
    Page Should Not Contain Element    ${CB_STORE_KEY_SCREEN}
    ...    message=A wrong quiz answer advanced to the store-encryption-key screen.

Enabling The Backup Lands On The Overview
    [Documentation]    Enable persists the key to the keystore and marks the backup configured; it
    ...                uploads nothing, so no cloud account is needed.
    [Tags]    id:cloud-backup.enable.overview    p1    needs-backend
    Skip Unless Backend Keyed
    Start At Store Key
    Should Be Enabled    ${CB_STORE_KEY_ENABLE}    false
    ...    Enable was active before the encryption key was acknowledged.
    Acknowledge Store Key
    Should Be Enabled    ${CB_STORE_KEY_ENABLE}    true
    ...    Enable stayed disabled after the acknowledgement was ticked.
    Tap    ${CB_STORE_KEY_ENABLE}
    Wait Until Page Contains Element    ${CB_OVERVIEW_SCREEN}    timeout=30s

Overview Lists Every Category Of Protected Data
    [Tags]    id:cloud-backup.overview.categories    p1    needs-backend
    Skip Unless Backend Keyed
    Start At Overview
    Page Should Contain Element    ${CB_OVERVIEW_ACCOUNTS}    message=The overview offers no Accounts row.
    Page Should Contain Element    ${CB_OVERVIEW_CONTACTS}    message=The overview offers no Contacts row.
    Page Should Contain Element    ${CB_OVERVIEW_PASSKEYS}    message=The overview offers no Passkeys row.
    Swipe Until In View    ${CB_OVERVIEW_CREDENTIAL_ADDRESS}
    Swipe Until In View    ${CB_OVERVIEW_SYNC_DEVICES}
    Swipe Until In View    ${CB_OVERVIEW_TURN_OFF}

Accounts Row Lists This Device's Wallet With Its Backup State
    [Tags]    id:cloud-backup.overview.accounts    p1    needs-backend
    Skip Unless Backend Keyed
    Start At Overview
    Tap    ${CB_OVERVIEW_ACCOUNTS}
    Wait Until Page Contains Element    ${CB_ACCOUNTS_SCREEN}    timeout=20s
    Account Row Should Declare Its Backup State

Contacts Row Opens The Contact List
    [Tags]    id:cloud-backup.overview.contacts    p2    needs-backend
    Skip Unless Backend Keyed
    Start At Overview
    Tap    ${CB_OVERVIEW_CONTACTS}
    Wait Until Page Contains Element    ${CB_CONTACTS_SCREEN}    timeout=20s

Passkeys Row Opens The Passkey List
    [Tags]    id:cloud-backup.overview.passkeys    p2    needs-backend
    Skip Unless Backend Keyed
    Start At Overview
    Tap    ${CB_OVERVIEW_PASSKEYS}
    Wait Until Page Contains Element    ${CB_PASSKEYS_SCREEN}    timeout=20s

Active Backup Survives An App Restart
    [Documentation]    Landing on the intro or choice screen instead would walk the user through
    ...                generating a second key, orphaning the first backup.
    [Tags]    id:cloud-backup.overview.persists    p1    needs-backend
    Skip Unless Backend Keyed
    Start At Overview
    Restart Pera
    Open Cloud Backup
    Page Should Contain Element    ${CB_OVERVIEW_SCREEN}
    ...    message=Re-entering Cloud Backup after a restart did not land on the overview, so the activation did not persist.
