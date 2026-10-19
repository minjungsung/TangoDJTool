# Workflow and file management proposal

This proposal guided the implemented workflow. See [the implementation and validation notes](workflow-and-file-management.md) for delivered behavior and remaining manual checks. The proposed navigation is Music → Sets → Tandas → Playback. The interpretation of Sets as named candidate-recording collections is provisional; confirm whether users instead mean complete event programs before implementing the new data model.

## Current behavior

- Local imports copy the audio into this site's IndexedDB storage. They do not upload it to an application server. Moving or renaming the original file does not affect the saved copy. Browser storage deletion, eviction, or switching browsers can remove access to that copy.
- The application has one library and one ordered list of tanda/cortina groups. Reusable tanda presets, multiple named collections, and event history are not implemented.
- Cortinas already support start/end positions and optional waiting before the next tanda. Next supports an early transition, with the configured fade.
- JSON export contains recording metadata and groups, without audio. Individual file relinking is available. Duplicate detection currently uses filename, size, and modification time rather than content identity.

## Proposed navigation and responsibilities

| Area | Responsibility | Main actions |
| --- | --- | --- |
| Music | Master recording catalog | Add/connect audio, search, edit tags, inspect source availability, preview, repair connections |
| Sets | Named candidate-recording collections | Create a collection, add existing catalog recordings, filter and select candidates |
| Tandas | Reusable DJ units | Choose and order usually 3–4 recordings from a collection, attach a cortina, save a name and notes |
| Playback | Ordered playback program and transport | Arrange tanda instances, inspect readiness, play, manually end cortinas, insert a recording to play next |

Collections and tandas reference stable recording IDs; they do not duplicate audio. A recording can belong to several collections and tandas. Three or four recordings is a useful default, with a warning rather than a hard limit for exceptions. A tanda does not require a cortina.

Tanda cards show name, style/orchestra, recording count, estimated duration, cortina summary, and missing-source status when collapsed. Expanded cards show recordings and order controls. Expansion state is saved independently of musical content. The default mobile presentation uses collapsed cards.

Saved tanda presets and playback-program instances are separate. Adding a preset creates an editable instance so changing a preset cannot silently change a live program. General edits to an upcoming instance require an explicit queue refresh; current playback retains its existing snapshot. The explicit play-next action below updates the upcoming queue immediately as part of that action.

## Cortina preparation and live control

- Place cortina selection and cue preparation inside the tanda editor. One library recording can provide different cortina cues for different tandas.
- Save a start position; an end position is optional. The normal workflow lets the DJ play from the cue and manually move on, without requiring a short fixed clip.
- Provide a prominent “Next tanda” button while a cortina is playing. It ends the cortina using the selected fade setting, then starts the next tanda. With fade off, transition directly. It also works when automatic advance is disabled and is disabled during an existing transition. With no next tanda, label the action “End cortina” and stop.
- Treat manual cortina advance as the default for newly created tandas. At the natural or configured endpoint, stop and wait for the DJ to start the next tanda. Retain automatic advance as an explicit option and preserve existing saved behavior during migration. Display the selected endpoint behavior clearly. With an unknown duration, show an unknown end rather than inventing a duration.
- Reject impossible cues and revalidate them when recording duration is discovered or a different recording is substituted.

## Add a recording to play next

Offer “Play next in this tanda” on a library recording while a tanda recording is active. Show the target tanda and the next recording in a persistent preview so the DJ can verify the insertion. Importing a new recording first must complete source preparation before the play-next action becomes available.

- Insert a new recording occurrence immediately after the active occurrence in the playback-program tanda, before its remaining recordings and attached cortina. Update both the program instance and upcoming queue atomically; retain the current recording, position, and pause state. The action does not start the added recording immediately.
- Preserve all previously queued recordings. If the last tanda recording is playing, insert before its cortina. Update recording count and estimated duration immediately; permit a fifth recording with an advisory rather than blocking the action.
- Keep the saved tanda preset unchanged. The playback-program change remains saved with the current workspace; the user can explicitly save it as a reusable tanda separately.
- Identify occurrences independently of recording IDs so repeated recordings can be inserted and removed without changing another occurrence of the same source.
- Consecutive play-next additions form a visible ordered block after the current recording, preserving the user's addition order. Allow reordering or removing pending additions. An undo applies only while its inserted occurrence is still pending.
- During a cortina or standalone-library playback, require an explicit target tanda. During a cortina, offer insertion at the beginning of the next tanda; do not silently reopen the completed tanda. With no next tanda, require selecting or creating one. Disable insertion while a track transition is in progress.
- Check source readiness before insertion and leave both the program and queue unchanged on failure. If the current occurrence advances during source preparation, re-evaluate the target before applying the insertion.

## Scope exclusion

DJ event records, event name/date/venue fields, planned-versus-actual comparisons, and performance logs are excluded from this development scope. Save editable musical content and the current workspace only.

## Audio storage modes

| Mode | Suitable environment | Storage and recovery |
| --- | --- | --- |
| Connect original | Supporting desktop browsers, initially Chrome/Edge after feature detection | Store a browser-granted file handle and catalog metadata; read the original for playback without retaining a full audio copy |
| Keep an app copy | Mobile, browsers without persistent file-handle support, or users choosing an independent copy | Keep the current IndexedDB audio storage; show its space usage and explain dependence on site storage |

Use source status labels such as Ready, Permission needed, File missing, and Stored copy. Ask for file access through a user action when permission needs renewal. Do not silently switch a linked recording into copied storage. An optional “Keep an app copy” action can provide independence from an external drive, with the storage cost shown first.

A stored path string alone is insufficient: browsers cannot freely open arbitrary filesystem paths. File handles are browser-specific access grants, cannot be used as portable backups, and do not guarantee continued access after a rename or move. Detect actual access instead of claiming that every move breaks or preserves a handle. Safari, Firefox, mobile, and the Android browser launcher must be evaluated by capability; browser installation alone does not enable desktop filesystem APIs.

## File movement and reconnection

1. Keep recording identity separate from its storage location. Collections, tanda instances, and analysis refer to the recording ID.
2. Before loading a program, check permission and readability of its linked files without interrupting current audio. Offer a separate full-library check.
3. If a file was moved or renamed and its handle no longer works, keep the catalog entry and musical references. Offer “Locate file” and, where directory access is supported, “Reconnect from folder.”
4. Scan only a user-selected directory. Use filename, size, and duration to narrow candidates; confirm identical bytes using a stored content hash. Compute hashes incrementally in a worker or another bounded-memory method for large libraries. Save hashes while source files are available so renamed files can later be identified.
5. Relink a verified identical file without discarding analysis, cues, or recording identity. Require user selection for ambiguous candidates. Re-encoded files and recordings with edited tags have different byte hashes and need a reviewed replacement flow; title or filename alone must not establish identity.
6. Treat replacement with different audio as a separate operation: refresh analysis and validate all affected cues. Changing a location does not replace the active audio source; source replacement follows explicit transport behavior.
7. For missing files in an upcoming program, present repair and explicit skip choices. Do not silently remove a tanda or assume a same-named file is the same recording.

Content hashing also improves duplicate detection. An identical file found at another location can update or add a source reference for the existing recording after review; metadata similarity only suggests potential duplicates. Do not automatically delete a user's original files or existing app copies.

## Delivery sequence and validation

1. Confirm the meaning of Sets and implement the four-area model, reusable tanda editor, collapse/expand, manual cortina controls, and play-next insertion. Migrate the current ordered groups into a preserved playback program; associate existing cortina groups with the preceding tanda where unambiguous and retain standalone/orphan cortinas explicitly. Keep an export backup and support existing JSON imports. Test insertion during playback and pause, insertion before a cortina, repeated sources, ordered multiple additions, removal/undo, transition races, and unchanged saved presets.
2. Introduce linked-original storage on supported desktop browsers, retain copied storage elsewhere, and add permission/status checks and individual reconnection. Test permission renewal, moved/renamed files, disconnected drives, storage failures, and mobile fallback.
3. Add content identity, folder reconnection, and duplicate review. Test renamed identical files, same-named different files, ambiguous candidates, re-encoded files, large libraries, and preservation of cues and analysis on identical relinking.

Before release, verify migration and export/import round trips, responsive navigation, manual cortina transitions, explicit queue refresh for general edits, immediate upcoming-queue updates for play-next insertion, and preservation of current audio during editing and file checks. The first release should prioritize the four-area workflow and dependable file recovery; bulk matching can follow.
