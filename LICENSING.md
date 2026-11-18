# Reusing Lingfern

Lingfern's code, documentation, learning materials and artwork do not all share one licence. The following terms apply only to rights controlled by the relevant Lingfern contributors. A file's presence in this repository does not establish ownership or override a more specific notice.

## What each licence covers

| Material | Terms |
|---|---|
| Lingfern-authored software, including program logic, build and preparation tools, tests, styles and functional configuration | [Apache License 2.0](LICENSE). Retain applicable copyright, licence and attribution notices. Incorporated third-party code keeps its own terms. |
| Lingfern-authored documentation and original non-code prose, including original interface, instructional and explanatory text | [CC BY 4.0](LICENSES/CC-BY-4.0.txt). Credit the contributors and project, link to the licence and indicate changes. The software containing a string is separately licensed as code. |
| Third-party code, dictionaries, passages, quotations, recordings, transcripts, fonts, models and outputs governed by separate terms | The applicable per-source or per-component terms. Lingfern's licences do not replace them or remove existing restrictions. Public-domain material gains no new restriction here. |
| Lingfern's name, symbol and derived brand icons | The separate [brand policy](BRAND.md). These artworks do not receive a general Apache or CC BY grant. |

Translations of third-party works and quoted text are not automatically Lingfern-owned content. Existing source, contributor, edition and territorial restrictions remain in effect. An included preparation record does not by itself mean a source is approved for distribution or use in a lesson.

## Attribution

Project: **Lingfern**  
Contributors: **Lingfern contributors**  
Project link: **https://lingfern.com**  
Source repository: **https://github.com/euanylin/lingfern**

The project link identifies Lingfern; it does not imply that a hosted service is currently available.

For Apache-licensed software, preserve the notices required by the licence and the supplied [NOTICE](NOTICE). NOTICE includes the Lingfern name and project link as informational attribution. It does not require a badge, advertising or prior approval, and it adds no commercial-use restriction or other licence condition.

For CC BY-covered documentation and original non-code content, a practical credit is:

> Based on Lingfern by Lingfern contributors — https://lingfern.com — CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. Changes: describe your changes.

Use attribution appropriate to the medium under the actual licence. This example is not mandatory wording or an endorsement. It must not replace the credit due to a third-party author.

The copyright notice “2026 Lingfern contributors” identifies project-controlled contributions. It does not assert ownership of third-party work or identify a separate legal entity.

## Third-party material

Keep the original credits, licence files and source-specific notices with any material you redistribute. Start with the [content and runtime dependency notices](public/THIRD_PARTY_NOTICES.md) and [development dependency notices](Dependency_Notices.md), then check the notices beside the particular text, dictionary or recording.

`content/about-credits.json` records direct dependency and bundled component roles, upstream repositories and licence identifiers. It also feeds the About page and the generated vendored-component notices. Engine, model and runtime terms appear separately. The [parser package notes](public/THIRD_PARTY_NOTICES.md#vendored-and-adapted-components) link the precise sources and retained notices.

The [original Java tidy-tree algorithm](https://github.com/cwi-swat/non-layered-tidy-trees/blob/e84be1bb8cc825fbe16ff000443cb8cf25ce8dd8/treelayout/algorithm/Paper.java#L3-L8) declares its code public domain in the source header. The [JavaScript port used by Lingfern](https://github.com/stetrevor/non-layered-tidy-tree-layout) declares MIT, and its [original MIT notice](public/licenses/non-layered-tidy-tree-layout@2.0.2/LICENSE) is retained.

<a id="pending-provenance-checks"></a>

### Phrase-head rule provenance

Lingfern replaced the previous rule table with [first-party English phrase-head heuristics](src/shared/tree-forms.ts). The new implementation uses grammatical category groups and constituent position. The [Penn Treebank II bracketing guidelines](https://languagelog.ldc.upenn.edu/myl/PennTreebank1995.pdf) describe the label vocabulary. The earlier table and its CoreNLP reference are absent from the release source and build.

Private learning data, credentials and private evidence are not licensed for publication by these terms. The public source contains no grant to access a user's learning records or connected services.

## Licence texts

The standard texts are preserved unchanged in [LICENSE](LICENSE) and [LICENSES/CC-BY-4.0.txt](LICENSES/CC-BY-4.0.txt). Their terms, together with applicable specific notices, are authoritative. No additional project condition overrides them.
