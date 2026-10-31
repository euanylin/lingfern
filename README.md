<a id="readme-top"></a>

# Lingfern

**[Website ↗](https://lingfern.com)**

<img src="public/icon.svg" width="96" alt="Lingfern">

English reading and listening practice for learners aged 16 and over, with learning goals from A1 to C2. Practice is generated locally from source texts and recordings. Learning works without an account or AI service.

<a id="readme-languages"></a>

<details>
<summary>Languages</summary>

<table>
<tbody>
<tr><td><a href="README.md">English</a></td><td><a href="docs/README.zh-CN.md">简体中文</a></td></tr>
<tr><td><a href="docs/README.zh-Hant.md">繁體中文</a></td><td><a href="docs/README.ja.md">日本語</a></td></tr>
<tr><td><a href="docs/README.ko.md">한국어</a></td><td><a href="docs/README.fr.md">Français</a></td></tr>
<tr><td><a href="docs/README.es.md">Español</a></td><td><a href="docs/README.de.md">Deutsch</a></td></tr>
<tr><td><a href="docs/README.pt.md">Português</a></td><td><a href="docs/README.it.md">Italiano</a></td></tr>
<tr><td><a href="docs/README.ru.md">Русский</a></td><td><a href="docs/README.ar.md">العربية</a></td></tr>
<tr><td><a href="docs/README.hi.md">हिन्दी</a></td><td><a href="docs/README.id.md">Bahasa Indonesia</a></td></tr>
</tbody>
</table>

</details>

<a id="readme-contents"></a>

<details>
<summary>Contents</summary>

1. [Get started](#readme-start)
2. [Practice and Test](#readme-practice)
3. [Reading and listening controls](#readme-workspace)
4. [History and progress](#readme-history)
5. [References and bookmarks](#readme-library)
6. [Offline and community resources](#readme-offline)
7. [Profiles and backups](#readme-backup)
8. [GitHub automatic sync](#readme-sync)
9. [AI handoff and MCP](#readme-ai)
10. [Language and appearance](#readme-preferences)
11. [Data and privacy](#readme-privacy)
12. [Run locally and contribute](#readme-development)
13. [Licence and credits](#readme-license)

</details>

<a id="readme-start"></a>

## Get started

1. Open [Lingfern](https://lingfern.com), follow the introduction and choose your starting points and interests.
2. Use [Today](https://lingfern.com/today) for **Reading**, **Listening** or **Combined**; choose **Practice** or **Test** in the preview. Combined keeps linked reading and listening sessions.
3. Use [Library](https://lingfern.com/library) for references/downloads and [Settings](https://lingfern.com/settings) for preferences, profiles and optional connections.

<a id="readme-practice"></a>

## Practice and Test

Configure reading/listening separately by goal level, topics, materials and question types, or keep **Automatic**. Choices are saved per profile. Depending on the material, tasks include multiple choice, completion/gaps, evidence selection, matching, tables, sequencing and open responses.

| Mode | Behaviour |
|---|---|
| Practice | Teaching examples, three hints (goal, clue, language), dictionary support and self-assessment where available. |
| Test | The same practice snapshot without assistance or AI; feedback after completion. Audio replay/seeking remain available. |

Objective answers receive task-specific scores and explanations. Open responses stay unscored; **Skip this question / Resume answering** preserves their drafts without awarding correctness.

<a id="readme-workspace"></a>

## Reading and listening controls

- Read the passage, select text for dictionary lookup or highlighting, and save material notes.
- Use the answer card to locate questions without opening input. Mobile reading has an expandable, resizable answer panel; desktop panes scroll independently.
- Listening shows every group/question for the current recording in order. Pause, replay or seek while answering; navigating questions retains playback and drafts.
- Drafts save as you answer. Submit after the final question, resume unfinished sessions, or confirm **Restart** to replace a session. If saving fails, use the displayed retry/recovery action or draft export before leaving.

<a id="readme-history"></a>

## History and progress

Open [**History**](https://lingfern.com/progress) from Today to revisit sessions, answers, feedback and assistance used; delete saved responses after confirmation. View reading/listening goal progress, and confirm completion times when clock-correction controls appear.

The activity fern reflects saved work, not certified proficiency. Daily quotations include their source, expansion for long text and a control to choose another quote.

<a id="readme-library"></a>

## References and bookmarks

| Tool | What it offers |
|---|---|
| [English dictionary](https://lingfern.com/library/dictionary) | Look up words and their English definitions, including from selected reading text. |
| [Bookmarks](https://lingfern.com/library/saved) | Save/remove definitions with ★/☆ and collapse entries. Unchecked entries remain until reopening/refreshing, so they can be restored immediately. |
| [IPA chart](https://lingfern.com/library/ipa) | Simple/Detailed views, sound search, recordings and English example words where available. |
| [English usage reference](https://lingfern.com/library/grammar) | Keyword search, alphabetical browsing and expandable explanations. |
| [Query history](https://lingfern.com/library/history) | Reopen dictionary, usage and IPA lookups with their source, time and saved lookup state. |

Choose Cambridge, Oxford Learner’s Dictionaries, Wiktionary or Merriam-Webster for external lookup. Links open the provider's website; usage links use Cambridge Grammar.

<a id="readme-offline"></a>

## Offline and community resources

Search, select, install, update or remove text, audio and reference packages in Library. Once required resources are installed, learning, scoring, saving and installed references work offline. Connection changes have temporary status feedback.

Import compatible community ZIPs containing materials/resources and keep the original ZIPs for reinstalling or another device. Downloads, GitHub, MCP and external websites need a connection; resource packages and recordings are installed per device.

Where supported, use your browser’s install/add-to-home-screen command to run Lingfern as a web app.

<a id="readme-backup"></a>

## Profiles and backups

Switch profiles in **Settings → Backup**. Export a ZIP using the suggested `lingfern-YYYY-MM-DD` name or your own name; the export name is saved inside the backup as the restored profile name. Renaming the downloaded ZIP does not replace that internal name.

Preview the profile and record counts before importing into a separate profile. Delete a local profile only after confirmation; other profiles and remote repository copies are retained.

Backups contain sessions, answers, drafts, bookmarks, query history, feedback and preferences. They are **unencrypted** and exclude installed resource packages/audio: keep them private and reinstall those resources separately.

<a id="readme-sync"></a>

## GitHub automatic sync

1. Connect GitHub in Settings, then select an account profile or copy your local profile into it.
2. Create a dedicated **private** data repository, grant the GitHub App access, then select and verify the repository in setup.
3. Automatic sync exchanges learning summaries, bookmarks, query history, preferences, installation choices and supported deletions. Offline changes are retained for reconnection.

The card shows syncing/synced/offline-pending/failure status and the last successful time; use **Sync now / Retry**, pause automatic sync, or disconnect the repository binding in setup. Conflicting data can be exported when the recovery control appears. Sync does not transfer full sessions, answers or installed audio: use a backup for full records.

**Disconnect GitHub identity** signs out every device, disables sync bindings, removes active shares and revokes MCP connections. Local records and repository files remain. Follow the displayed steps if GitHub-side revocation cannot be confirmed. Individual MCP shares/connections can also be revoked without disconnecting identity.

<a id="readme-ai"></a>

## AI handoff and MCP

- For eligible saved responses, select the goal, material/excerpt, task, answer and feedback to include. Preview, copy, export Markdown/JSON or use system sharing where supported. Paste/import returned feedback, review it and save it separately; original answers and scores do not change.
- Connect a compatible **Streamable HTTP + OAuth** client at `https://lingfern.com/mcp`, then explicitly share a snapshot with that connection. Shares expire after **24 hours**, or earlier when the connection expires. Manage/revoke shares and clients in Settings. Authorised clients can search/read their shared snapshots and, with the separate permission, search public material summaries. See [client setup and tools (English)](docs/mcp-clients.md).

<a id="readme-preferences"></a>

## Language and appearance

Fourteen interface languages; light/dark/system themes; separate desktop/mobile text, icon or combined navigation; default online dictionary; adjustable starting points and interests; keyboard/touch access and reduced-motion support.

English material stays English. A1–A2 reviewed guidance has translated support; B1–C2 guidance and About remain English. Arabic navigation uses RTL while English content stays LTR.

**Check for updates → Update now** reloads with saved progress retained. About and material details provide project links, source credits and licences.

<a id="readme-privacy"></a>

## Data and privacy

Records live in this browser's site storage. Export a backup before clearing site data or changing devices. GitHub sync is optional and is not a full backup.

No advertising or default telemetry. AI access is limited to explicitly selected/shared context, not private history. Revocation cannot erase copies already received by another service. Results describe task performance, not a certified CEFR level or examination score.

<a id="readme-development"></a>

## Run locally and contribute

Use the Node.js version in [`.nvmrc`](.nvmrc), then run from the repository root:

```sh
npm ci
npm run build
npm run preview
```

Open [the local preview](http://127.0.0.1:8787/today). GitHub/Cloudflare credentials are not required for local learning.

- [User guide](docs/user-guide.md)
- [Development and checks](docs/development.md)
- [Community ZIP format](community-content.md)
- [MCP clients](docs/mcp-clients.md)
- [Issues](https://github.com/euanylin/lingfern/issues)

Include reproduction steps when reporting a problem; exclude private records and credentials.

<a id="readme-license"></a>

## Licence and credits

Lingfern-authored code: [Apache-2.0](LICENSE). Original documentation/non-code content: [CC BY 4.0](LICENSES/CC-BY-4.0.txt). Retain applicable attribution and the project link. Third-party materials keep their own terms; the logo has a separate [brand policy](BRAND.md).

- [Licensing](LICENSING.md)
- [Content/runtime credits](public/THIRD_PARTY_NOTICES.md)
- [Development dependency notices](Dependency_Notices.md)

[Back to top](#readme-top)
