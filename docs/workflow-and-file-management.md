# Four-area workflow and audio sources

The application now uses Music → Sets → Tandas → Playback. Sets are named candidate-recording collections. Select recordings in a set to create an editable tanda. Tandas use existing catalog recordings, keep notes and expansion state, and support an attached cortina. Save a tanda as a reusable original; adding it to playback creates an independent instance. No DJ event records or performance logging are included.

## Live preparation

Use Play next on a recording while a tanda is active. It inserts after the active recording without restarting audio or changing pause state. Several additions retain selection order. Pending additions can be canceled or reordered. Repeated recordings have separate occurrence IDs. The last-song insertion precedes its cortina. During a cortina, select a future tanda; a new target can be created if needed. The current workspace saves the modified program while reusable originals remain unchanged.

General tanda edits require Update upcoming queue. Play-next insertion updates the program and queue directly; a failed workspace save rolls back that addition. Stop cancels a pending transition.

New cortinas default to their full remaining recording and manual advance. Set the start position, optionally enable a fixed endpoint, and choose whether to wait at the end. Next tanda fades out according to the selected fade and starts the next tanda. If no tanda remains, End cortina fades out and stops. Existing saved cortina settings and sample behavior are preserved.

## File management

Local files copies audio into IndexedDB without a server upload. Connect originals is shown only when persistent file-picker APIs are supported; it stores a browser-granted handle and reads the original in place. The Android launcher and mobile browsers use available browser capabilities rather than assuming filesystem access.

Check files inspects permissions and readability. Loading the full program also checks its local sources before starting. A missing file or a needed permission remains visible and requires repair. Locate file verifies the original content identity; Reconnect from folder scans only a user-selected directory and presents verified matches for explicit selection. Multiple identical matches remain separate choices. Same-named different files and re-encoded files are not automatically accepted.

New imports calculate SHA-256 incrementally in a worker using bounded-size chunks. Existing stored audio acquires identity during restoration or a file check. Content-identical imports are skipped even under a different name; connecting such an original can reuse an existing recording after review. Keep an app copy shows the space cost before converting a linked source to copied storage.

Identical relinking preserves recording IDs, analysis, and cues. Source/metadata updates use a revision-checked transaction so stale tabs cannot change newer saved connections. Replacement with different audio is explicit and resets analysis; cues are checked against source duration by the editor and player. Reconnection does not interrupt the active audio snapshot. File handles are local access grants and are excluded from exported JSON.

## Persistence and compatibility

IndexedDB upgrades from version 1 to version 2, adding a separate sources store while preserving files and state. Current JSON version 1 backups remain accepted; new optional collections, presets, and occurrence IDs are validated. Legacy consecutive cortinas acquire a parent relationship without changing their order or automatic-advance settings. Standalone cortinas remain explicit. Audio and raw handles are not included in metadata backups.

## Validation limits

Automated checks exercise repeated-source insertion, rollback on save failure, canceled fades, collapsed cards, collection/preset round trips, copied-file content identity, and mock file-handle permission/folder recovery. Browser feature suites cover local playback, fades, storage conflicts, imports, recovery, and responsive workflows. Automated file handles model browser grants; physical file moves, external-drive removal, and permission persistence across browser restarts still require manual checks in a supporting browser. Real YouTube availability and device volume behavior remain provider/device dependent.

## Completed checks

- Unit tests: 17 passed.
- Default browser regressions and new workflows: 62 passed, including destination separation and toolbar bounds at 320, 390, 1024, and 1440 pixels in English, Korean, and Spanish.
- Production feature review: 60 passed across desktop Chromium, phone Chromium, and tablet WebKit.
- New workflows in WebKit: 10 behavioral checks passed, followed by all 3 responsive-language checks. The layout checks wait for viewport resizing to finish before measuring controls.
- First-use onboarding: 12 passed across Chromium and WebKit.
- Additional WebKit device checks: 8 passed, with the existing explicit analyser-output skip.
- Production build and whitespace checks passed. Music, Sets, Tandas, and destination dialogs were also inspected visually on phone, tablet, and desktop layouts.

WebKit development-server runs emitted Vite module-import diagnostics during test navigation/reloads; all workflow assertions passed. Production feature review passed without page errors. PWA installation checks from the earlier release preparation are outside this change and their previously reported service-worker limitation remains unresolved.


## Candidate sets and destination controls

First visits seed seven curated candidate collections alongside the existing 28 recordings and six-tanda playback program: four tango collections, one vals collection, one milonga collection, and six cortina selections. Each dance collection retains a consistent orchestra, singer or instrumental ensemble, and period. Restoring saved workspaces does not reseed collections. Explicitly loading examples restores missing sample collections without replacing personal sets or edited recordings.

The library distinguishes Collect in set from Add to tanda. Candidate collection opens a set-specific dialog with the selected recording and an explanation of its effect. The destination selector shows the target tanda or cortina; a missing destination opens a separate tanda-selection dialog. Browsing recordings from a candidate set maintains that destination until Back to set. Editing, analysis, file recovery, copying, and deletion use the More menu at all viewport sizes. Tanda toolbars use consistent control columns, checkboxes retain their intrinsic size, and navigation returns to the top of the workspace.

Next-addition controls disable during a save and re-enable after success or failure, including when playback is paused. This allows consecutive insertions while retaining the active recording and insertion order.
