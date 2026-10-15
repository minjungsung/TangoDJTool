# Tango DJ Studio promotion kit

## Positioning

Prepare tango tandas, choose cortina segments, and keep your next recording in view in a browser workspace.

Start with tango DJs preparing sets, teachers preparing class music, and dancers arranging home practice. Invite a small pilot group before positioning the app for larger live events.

## Before sharing

Provide a working public HTTPS demo URL. Static hosting is supported; use a stable origin so visitors retain their saved browser workspace. The repository alone requires installation and adds friction for nontechnical visitors. Verify example playback, importing a local recording, saving, and reloading on the deployed origin before sharing it.

Record a 30-second screen demo:

1. Load the example milonga set and show its tandas.
2. Play a cortina source, choose its From/To interval, and check the segment.
3. Update the upcoming queue while the current recording continues.
4. Show the remaining time and next recording, then export the set.

Use music you have permission to include in a promotional video, or record the screen without captured music. Link to the app and repository in the accompanying caption.

## Initial outreach

- Invite five tango DJs or teachers to prepare one real tanda and cortina. Ask what slowed them down and what would stop them using it again.
- Share the short demo with a relevant local tango community or DJ group, following its posting rules. Frame the invitation as a request for practical feedback.
- After addressing recurring feedback, share an English or Spanish introduction with international tango DJ communities. The app supports Korean, English, and Spanish.

Suggested first-week target: five people try the app, three provide concrete feedback, and two return to prepare another set. Track this through voluntary feedback; no analytics setup is required for the pilot.

## Ready-to-use introduction

> I built Tango DJ Studio, a browser workspace for preparing tango sets. You can organize tandas, choose cortina segments, see the remaining time and next recording, and update upcoming music while the current track keeps playing. It supports local audio and YouTube links, with Korean, English, and Spanish interfaces. I’m looking for a few DJs and teachers to try preparing a set and tell me what feels awkward or is missing.
>
> Try it: [public demo URL]
> Source: [repository URL]

## Accurate claims

Say that local recordings and set metadata are saved in the visitor's browser, and that exported JSON transfers set metadata while audio must be relinked. Describe YouTube as an online embedded source whose availability and playback can vary.

The current automated verification has 11 passing unit tests, 34 passing browser tests, and a successful production build. A baseline real-video set reached its end and restarted; a stall was observed. The committed session snapshot is incomplete and does not establish two-hour reliability.

Separate headphone routing, guaranteed offline cold startup, and next-track preloading are not available. Introduce preparation and practice workflows first; evaluate any live-event use with local recordings and the venue's actual equipment.
