<a id="readme-top"></a>

# Lingfern

**[Site web ↗](https://lingfern.com)**

<img src="../public/icon.svg" width="96" alt="Lingfern">

Entraînement à la lecture et à la compréhension orale en anglais, dès 16 ans, avec des objectifs de A1 à C2. Les exercices sont générés localement à partir de textes et d’enregistrements. Aucun compte ni service d’IA n’est nécessaire pour apprendre.

Le site public utilise **0.1.170**. Les arbres syntaxiques, le dictionnaire d’usage enrichi, les palettes et les crédits About mis à jour sont disponibles dans **l’aperçu local 0.2.0**. [État de publication](../DEVELOPMENT_HANDOFF.md#current-work-and-publication).

<a id="readme-languages"></a>

<details>
<summary>Langues</summary>

<table>
<tbody>
<tr><td><a href="../README.md">English</a></td><td><a href="README.zh-CN.md">简体中文</a></td></tr>
<tr><td><a href="README.zh-Hant.md">繁體中文</a></td><td><a href="README.ja.md">日本語</a></td></tr>
<tr><td><a href="README.ko.md">한국어</a></td><td><a href="README.fr.md">Français</a></td></tr>
<tr><td><a href="README.es.md">Español</a></td><td><a href="README.de.md">Deutsch</a></td></tr>
<tr><td><a href="README.pt.md">Português</a></td><td><a href="README.it.md">Italiano</a></td></tr>
<tr><td><a href="README.ru.md">Русский</a></td><td><a href="README.ar.md">العربية</a></td></tr>
<tr><td><a href="README.hi.md">हिन्दी</a></td><td><a href="README.id.md">Bahasa Indonesia</a></td></tr>
</tbody>
</table>

</details>

<a id="readme-contents"></a>

<details>
<summary>Sommaire</summary>

1. [Démarrer](#readme-start)
2. [Entraînement et test](#readme-practice)
3. [Lecture et commandes audio](#readme-workspace)
4. [Historique et progression](#readme-history)
5. [Références et favoris](#readme-library)
6. [Ressources hors ligne et communautaires](#readme-offline)
7. [Profils et sauvegardes](#readme-backup)
8. [Synchronisation GitHub automatique](#readme-sync)
9. [Transfert vers une IA et MCP](#readme-ai)
10. [Langue et apparence](#readme-preferences)
11. [Données et confidentialité](#readme-privacy)
12. [Exécution locale et contributions](#readme-development)
13. [Licences et crédits](#readme-license)

</details>

<a id="readme-start"></a>

## Démarrer

1. Ouvrez [Lingfern](https://lingfern.com), consultez la présentation et choisissez vos points de départ et centres d’intérêt.
2. Dans [Aujourd’hui](https://lingfern.com/today), choisissez **Lecture**, **Écoute** ou **Combiné**, puis **Entraînement** ou **Test** dans l’aperçu. Le mode combiné conserve deux sessions liées.
3. La [Bibliothèque](https://lingfern.com/library) regroupe recherches et téléchargements ; les [Paramètres](https://lingfern.com/settings), préférences, profils et connexions facultatives.

<a id="readme-practice"></a>

## Entraînement et test

Réglez séparément niveau cible, sujets, supports et types de questions pour la lecture et l’écoute, ou gardez **Automatique**. Les choix sont enregistrés par profil. Selon le support : QCM, textes à trous, sélection de preuves, associations, tableaux, remise en ordre et réponses ouvertes.

| Mode | Fonctionnement |
|---|---|
| Entraînement | Exemples, trois indices (objectif, piste, langue), dictionnaire et autoévaluation lorsqu’ils sont disponibles. |
| Test | Le même exercice, sans assistance ni IA ; retour après la fin. Réécoute et déplacement dans l’audio restent possibles. |

Les questions objectives reçoivent une correction et une explication. Les réponses ouvertes ne sont pas notées automatiquement ; **Passer / Reprendre la réponse** conserve le brouillon sans attribuer de réussite.

<a id="readme-workspace"></a>

## Lecture et commandes audio

- Sélectionnez un passage pour consulter le dictionnaire ou surligner ; enregistrez des notes sur le support.
- La grille de réponses localise une question sans activer la saisie. Sur mobile, le panneau de réponses se déplie et se redimensionne ; sur ordinateur, le texte défile avec la page et le panneau de réponses séparément.
- Toutes les questions et tous les groupes de l’enregistrement courant apparaissent dans l’ordre. Pause, réécoute, déplacement audio et navigation préservent lecture et brouillons.
- Les brouillons sont enregistrés pendant la réponse. Validez après la dernière question, reprenez une session inachevée ou confirmez **Recommencer** pour la remplacer. En cas d’échec de sauvegarde, utilisez les actions de réessai, récupération ou export du brouillon avant de quitter.

<a id="readme-history"></a>

## Historique et progression

Dans Aujourd’hui, ouvrez l’historique pour revoir les séances et réponses ou reprendre une séance. Vous pouvez supprimer une séance ou un résultat synchronisé autonome après confirmation. Supprimer une séance combinée efface ses deux parties liées. Confirmez l’heure de fin si l’option de correction apparaît.

La fougère représente l’activité sauvegardée, pas un niveau certifié. Les citations quotidiennes indiquent leur source ; un texte long peut être déplié et une autre citation choisie.

<a id="readme-library"></a>

## Références et favoris

| Outil | Fonctions |
|---|---|
| [Dictionnaire anglais](https://lingfern.com/library/dictionary) | Recherche de mots avec définitions en anglais, y compris depuis un texte sélectionné. |
| [Favoris](https://lingfern.com/library/saved) | ★/☆ pour enregistrer ou retirer une définition ; entrées repliables. Une entrée retirée reste jusqu’à la réouverture ou l’actualisation pour pouvoir être rétablie. |
| [Tableau IPA](https://lingfern.com/library/ipa) | Vues simple/détaillée, recherche de sons, enregistrements et exemples anglais disponibles. |
| [Dictionnaire d’usage anglais](https://lingfern.com/library/grammar) | Recherche par mot-clé, parcours alphabétique et explications dépliables. |
| [Arbre syntaxique](#readme-syntax-tree) · 0.2.0 | Générer et modifier neuf représentations, enregistrer des instantanés nommés et exporter en SVG, PNG, WebP, JPEG ou PDF. |
| [Historique des recherches](https://lingfern.com/library/history) | Réouverture des recherches dictionnaire, usage et IPA avec source, heure et état conservé. |

L’aperçu local contient **191 entrées**. Les explications suivent la langue de l’interface et reviennent à l’anglais si nécessaire. Exemples, constructions et contrastes restent en anglais.

<a id="readme-syntax-tree"></a>

**Bibliothèque** → **Référence** → **Arbre syntaxique** · [0.2.0](http://127.0.0.1:8787/library/trees)

Saisissez une phrase, un arbre entre parenthèses, un plan indenté ou une notation de dépendances. Les commandes des nœuds sont au-dessus du canevas, les symboles juste en dessous. Activez **Déplacement** pour relier des nœuds par coindexation ; cliquez à nouveau ou appuyez sur Échap pour quitter ce mode. Le clic droit ou l’appui long ouvre le menu. Un brouillon local par profil est automatiquement enregistré et restauré, mais exclu des sauvegardes et de la synchronisation. **Enregistrer** crée un instantané nommé distinct dans l’historique. Effacer reste annulable pendant la visite ; rouvrir un brouillon vidé rétablit l’exemple. Appuyez sur **Entrée** pour dessiner ou sur **Maj+Entrée** pour insérer une ligne.

Vous pouvez aussi coller une dérivation CCGbank AUTO pour en conserver les catégories et les branches.

Dans **Bibliothèque** → **Contenu hors ligne** → **Références** → **Arbre syntaxique**, sélectionnez les modèles voulus puis **Télécharger la sélection**. UDPipe analyse les dépendances. Stanza (avec UDPipe) ou Charniak installé analyse les constituants. Hol-CCG produit les dérivations CCG. Les règles intégrées fonctionnent hors ligne si le modèle est indisponible ou si sa sortie est rejetée. Vérifiez l’analyse avant de l’utiliser.

Choisissez Cambridge, Oxford Learner’s Dictionaries, Wiktionary ou Merriam-Webster pour les recherches externes. Les liens ouvrent le site du fournisseur ; les liens d’usage utilisent Cambridge Grammar.

<a id="readme-offline"></a>

## Ressources hors ligne et communautaires

Dans la Bibliothèque, recherchez, sélectionnez, installez, mettez à jour ou supprimez les packs de textes, d’audio et de références. Une fois les ressources nécessaires installées, apprentissage, correction, sauvegarde et références installées fonctionnent hors ligne. Un bref indicateur signale les changements de connexion.

Importez des ZIP communautaires compatibles et gardez les originaux pour réinstallation ou changement d’appareil. Téléchargements, GitHub, MCP et sites externes nécessitent une connexion ; ressources et audio s’installent sur chaque appareil.

Si le navigateur le permet, utilisez son option d’installation ou d’ajout à l’écran d’accueil pour utiliser Lingfern comme application web.

<a id="readme-backup"></a>

## Profils et sauvegardes

Changez de profil dans **Paramètres → Sauvegarde**. Exportez un ZIP nommé `lingfern-YYYY-MM-DD` ou avec votre propre nom : ce nom est aussi enregistré à l’intérieur pour le profil restauré. Renommer le fichier ZIP ne modifie pas ce nom interne.

Vérifiez nom et nombre d’enregistrements avant l’import dans un profil distinct. La suppression d’un profil local demande confirmation ; les autres profils et les copies du dépôt distant sont conservés.

Les sauvegardes contiennent sessions, réponses, brouillons, favoris, historique, retours et préférences. Elles sont **non chiffrées**, sans les packs ni l’audio installés : gardez-les privées et réinstallez les ressources séparément.

<a id="readme-sync"></a>

## Synchronisation GitHub automatique

1. Connectez GitHub dans les Paramètres ; choisissez un profil du compte ou copiez-y votre profil local.
2. Créez un dépôt de données dédié **privé**, accordez l’accès à la GitHub App, puis sélectionnez et vérifiez le dépôt pendant la configuration.
3. La synchronisation bidirectionnelle échange résumés d’apprentissage, favoris, historique, préférences, choix d’installation et suppressions prises en charge. Les changements hors ligne attendent la reconnexion.

La carte indique synchronisation en cours, terminée, en attente hors ligne ou échec, ainsi que la dernière réussite. Utilisez **Synchroniser / Réessayer**, suspendez l’automatisme ou détachez le dépôt dans la configuration. Les données conflictuelles sont exportables lorsque cette récupération est proposée. Sessions complètes, réponses et audio ne sont pas transférés : utilisez une sauvegarde pour tous les enregistrements.

**Déconnecter l’identité GitHub** ferme les sessions sur tous les appareils, désactive les liaisons de synchronisation, supprime les partages actifs et révoque les connexions MCP. Données locales et fichiers du dépôt restent. Suivez les instructions si la révocation côté GitHub n’est pas confirmée. Vous pouvez aussi révoquer un partage ou une connexion MCP sans déconnecter l’identité.

<a id="readme-ai"></a>

## Transfert vers une IA et MCP

- Pour une réponse enregistrée compatible, choisissez objectif, support/extrait, question, réponse et retour. Prévisualisez, copiez, exportez en Markdown/JSON ou utilisez le partage système disponible. Collez/importez le retour reçu, vérifiez-le et enregistrez-le séparément ; réponses et scores d’origine restent intacts.
- Connectez un client **Streamable HTTP + OAuth** à `https://lingfern.com/mcp`, puis partagez explicitement un instantané avec cette connexion. Il expire après **24 heures**, ou avant si la connexion expire. Gérez/révoquez partages et clients dans les Paramètres. Les clients autorisés recherchent/lisent leurs instantanés et, avec une permission distincte, recherchent les résumés de supports publics. [Configuration et outils (anglais)](mcp-clients.md).

<a id="readme-preferences"></a>

## Langue et apparence

Quatorze langues d’interface ; thème clair/sombre/système ; navigation texte, icônes ou mixte distincte sur ordinateur et mobile ; dictionnaire externe par défaut ; points de départ et intérêts modifiables ; clavier, tactile et préférence de réduction des animations.

**0.2.0** · Changez de couleurs dans **Paramètres** → **Palette**. **33 palettes** sont proposées : **Par défaut** et 32 alternatives, dont **Fougère**, toutes en clair et sombre. Le mode système/clair/sombre est enregistré séparément. Choisissez Par défaut pour rétablir la palette initiale. Les couleurs suivent vos préférences sur le site, l’introduction et les pages installées hors ligne ; le logo et la fougère d’Aujourd’hui gardent leurs couleurs d’origine.

Les supports anglais restent en anglais. Les consignes A1–A2 révisées ont une aide traduite ; les consignes B1–C2 et About restent en anglais.

**Rechercher des mises à jour → Mettre à jour** recharge la page en conservant la progression sauvegardée. [À propos](https://lingfern.com/settings/about) et les détails des supports donnent liens du projet, sources et licences.

<a id="readme-privacy"></a>

## Données et confidentialité

Les données restent dans le stockage du site de ce navigateur. Sauvegardez avant de l’effacer ou de changer d’appareil. La synchronisation GitHub est facultative et ne remplace pas une sauvegarde complète.

Aucune publicité ni télémétrie activée par défaut. L’IA ne reçoit que le contexte sélectionné/partagé, pas l’historique privé. Une révocation ne peut effacer les copies déjà reçues ailleurs. Les résultats décrivent des performances aux tâches, pas un niveau CECR certifié ni une note d’examen.

<a id="readme-development"></a>

## Exécution locale et contributions

Utilisez la version Node.js de [`.nvmrc`](../.nvmrc), puis, à la racine du dépôt :

```sh
npm ci
npm run build
npm run preview
```

Ouvrez [l’aperçu local](http://127.0.0.1:8787/today). L’apprentissage local ne demande pas d’identifiants GitHub/Cloudflare.

- [Guide d’utilisation (anglais)](../README.md#readme-contents)
- [Développement et vérifications (anglais)](development.md)
- [Format ZIP communautaire](../community-content.md)
- [Clients MCP (anglais)](mcp-clients.md)
- [Issues](https://github.com/euanylin/lingfern/issues)

Décrivez les étapes de reproduction sans joindre données privées ni identifiants.

<a id="readme-license"></a>

## Licences et crédits

Code original : [Apache-2.0](../LICENSE). Documentation et contenu original non logiciel : [CC BY 4.0](../LICENSES/CC-BY-4.0.txt). Conservez les mentions requises et le lien du projet. Les ressources tierces gardent leurs conditions ; le logo relève de la [politique de marque](../BRAND.md).

- [Licences](../LICENSING.md)
- [Crédits des contenus et dépendances d’exécution](../public/THIRD_PARTY_NOTICES.md)
- [Dépendances de développement](../Dependency_Notices.md)

[Retour en haut](#readme-top)
