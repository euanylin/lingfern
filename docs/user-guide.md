# Using Lingfern

[Home](../README.md) · [简体中文介绍](README.zh-CN.md)

Lingfern helps you practise English reading and listening, keep your answers, and revisit feedback. You can learn without an account. The hosted service has not launched yet; this guide describes the application available in the local preview.

## Start a session

1. Open **Today** and choose **Reading**, **Listening** or **Combined**.
2. Review the learning goal and choose **Practice** or **Test**.
3. Work through the material and questions. You can move between questions and edit answers before finishing.
4. Finish the session to save the completed answers and view feedback.

Combined training runs Reading followed by Listening and keeps both sessions. To return to saved work, use **History** at the top of Today's Reading section.

Draft answers are saved as you work. If a save fails, keep the page open and follow the error message before leaving or clearing anything.

## Practice and Test

**Practice** offers hints and dictionary support. Hints can remind you of the goal, point towards a clue or explain language. Feedback appears after you finish.

**Test** uses the same material and questions without hints, dictionary assistance, teaching examples, self-assessment or AI support. Feedback appears after completion. Normal audio replay and seeking remain available.

Objective questions have task-specific scoring and explanations. Open responses are saved without an automatic score. Results are evidence about these tasks, not a certified language level or a conversion to an examination score.

## Prepare for offline use

While connected, open **Library**, select the materials, audio and reference resources you want, and wait for installation to finish. Opening a page alone does not install every resource.

After the application and required resources are installed, reading, listening, answers, review and local backups work offline. Materials you have not installed still need a connection. Downloads, external dictionary websites, GitHub connections and external AI services also need their own network access.

If a download fails, check your connection and available storage, then retry. Before a trip or a period without access, open the installed material and check that its audio plays on the device you will use.

## Back up and move your work

Learning data belongs to the current browser profile and site address. Another browser, device or local preview address has separate storage. Private browsing and browser storage cleanup can make that data temporary or remove it.

To make a backup:

1. In **Settings**, find the profile and backup controls and select the profile you want to preserve.
2. Export its backup ZIP and keep it somewhere private.
3. Keep another copy before clearing browser data or changing devices.

To restore, choose the backup ZIP in Settings, review the displayed profile and record counts, and confirm the import. Lingfern restores it into a new profile and switches to that profile. Existing profiles are kept.

A backup contains saved sessions, responses and related learning records. It does not include installed resource packs or audio; install those separately on the destination device. Backup ZIPs are not encrypted and may contain your answers and material text. Do not attach them to a public issue.

## Optional online connections

**GitHub sign-in, repository sync and MCP are not ready for general use yet.** They remain optional for learning. The following explains their intended use once the hosted service is available.

### GitHub and sync

Signing in identifies your account; it does not require you to bind a repository. Sync uses a dedicated **private** data repository that you select separately. This is different from the public Lingfern source repository. Give the GitHub App access only to that selected data repository.

If sync fails, local learning stays saved; keep the local profile and pending work while resolving the error. Signing out, disconnecting sync and disconnecting your GitHub identity are separate actions. Disconnecting does not remove content already stored in a repository or its Git history.

### MCP and external AI

MCP lets a compatible external client request the snapshots you explicitly share. A connection does not grant access to your entire learning history. Review the content, permissions and expiry before confirming a share. You can revoke shares and client access from Settings.

Revocation stops further access through Lingfern. It cannot erase a copy that a client or external service has already received; that service has its own data policy. AI feedback remains separate from your original answers and task scores.

## Language and material credits

Choose the interface language in Settings. Navigation and controls support 14 languages. English passages, recordings and answers remain English. Reviewed beginner guidance has display translations; B1–C2 guidance and About use English.

Material details show the relevant source and credit. Texts, recordings and dictionaries can have different reuse terms; do not assume the application's code licence covers them. See the [licensing guide](../LICENSING.md) for reuse.

## Get help

If something goes wrong, note the page, steps, error message, browser and operating system. [Open an issue](https://github.com/euanylin/lingfern/issues) with a small example that does not contain private data. Redact account details and learning text from screenshots. Never post passwords, tokens, backup ZIPs or private repository contents.
