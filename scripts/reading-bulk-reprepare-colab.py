"""Reprepare acquired OpenStax CNXML using senior-author evidence from its preface."""
import ast, datetime, gzip, hashlib, json, pathlib, re, shutil, traceback, zipfile, xml.etree.ElementTree as ET
from collections import Counter
LOG = pathlib.Path('/content/reprepare-log.txt')
def log(message):
    with LOG.open('a') as handle:
        handle.write(message + '\n')

SOURCE = pathlib.Path('/content/lingfern-reading-bulk-20261010')
OUT = pathlib.Path('/content/lingfern-reading-bulk-authors-20261010')
BY = 'https://creativecommons.org/licenses/by/4.0/'
TARGET = 1000
parsed = ast.parse(pathlib.Path('/content/reading-bulk-colab.py').read_text())
env = {'re': re, 'hashlib': hashlib}
exec(compile(ast.Module([node for node in parsed.body if isinstance(node, ast.FunctionDef) and node.name in {'sha', 'norm', 'cnxml_paragraphs', 'reason'}], []), '', 'exec'), env)
sha, norm, cnxml_paragraphs, reason = env['sha'], env['norm'], env['cnxml_paragraphs'], env['reason']
name_re = re.compile(r"^((?:[A-Z]\.\s)?[A-Z][A-Za-z.'’\-]+(?:\s(?:[A-Z]\.|[A-Z][A-Za-z.'’\-]+)){1,4})(?:\s*\([^)]+\))?,\s+(?!Dr\b|Professor\b)[A-Z]")

def para_lines(para):
    parts = [para.text or '']
    for child in list(para):
        tag = child.tag.split('}')[-1]
        parts.append('\n' if tag == 'newline' else ''.join(child.itertext()))
        parts.append(child.tail or '')
    return [line.strip() for line in ''.join(parts).split('\n') if line.strip()]

def senior_names(path):
    doc = ET.fromstring(path.read_bytes())
    names = []
    for section in doc.iter():
        if section.tag.split('}')[-1] != 'section' or 'sr-contrib-auth' not in section.attrib.get('class', ''):
            continue
        for para in section.iter():
            if para.tag.split('}')[-1] != 'para':
                continue
            if any(ancestor.tag.split('}')[-1] in {'figure', 'media'} for ancestor in []):
                continue
            for line in para_lines(para):
                match = name_re.match(line)
                if not match or match.group(1).startswith(('Dr. ', 'Dr ', 'Professor ')):
                    continue
                name = match.group(1).strip()
                if name not in names and 1 < len(name.split()) <= 6:
                    names.append(name)
    return [name for name in names if not any(name != other and name in other.split(' (')[0] and len(other) > len(name) for other in names)]

def authors_for(collection, work, modules):
    listed = [item.strip() for item in collection.attrib.get('authors', '').split(',') if item.strip()]
    if listed:
        return listed, 'collection-authors-attribute'
    for module in modules[:8]:
        path = SOURCE / 'raw' / f'{work}-{module}.cnxml'
        if path.exists():
            found = senior_names(path)
            if found:
                return found[:32], f'preface-senior-authors:{module}'
    return [], ''

def run():
    if LOG.exists():
        LOG.unlink()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    (OUT / 'raw').mkdir()
    baseline = json.loads(gzip.decompress(pathlib.Path('/content/cloud-public-baseline.json.gz').read_bytes()))
    old, old_roots, seen = set(baseline['textHashes']), set(baseline['rootIds']), {}
    rows, holds, chapters, ledger = [], [], [], []
    for collection_path in sorted((SOURCE / 'raw').glob('*-collection.xml')):
        log('start ' + collection_path.name)
        raw = collection_path.read_bytes()
        collection = ET.fromstring(raw)
        work = collection_path.name.replace('-collection.xml', '')
        repo = next(item['repository'] for item in json.loads((SOURCE / 'source-ledger.json').read_text()) if item['workId'] == work)
        commit = next(item['commit'] for item in json.loads((SOURCE / 'source-ledger.json').read_text()) if item['workId'] == work)
        grant = next((node.attrib.get('url', '') for node in collection.iter() if node.tag.split('}')[-1] == 'license'), '').replace('http://', 'https://')
        language = collection.attrib.get('{http://www.w3.org/XML/1998/namespace}lang', '') or next((node.text.strip() for node in collection.iter() if node.tag.split('}')[-1] == 'language' and node.text), '')
        title = norm(''.join(next(node for node in collection.iter() if node.tag.split('}')[-1] == 'title').itertext()))
        modules = [node.attrib['document'] for node in collection.iter() if node.tag.split('}')[-1] == 'module']
        authors, author_source = authors_for(collection, work, modules)
        root = 'openstax-book-' + work.removeprefix('openstax-')
        book_hold = None
        if grant != BY:
            book_hold = 'book-grant-not-cc-by-4'
        elif language != 'en':
            book_hold = 'book-language-not-english'
        elif not authors or len(authors) > 32:
            book_hold = 'book-authors-not-in-source'
        elif root in old_roots:
            book_hold = 'historical-underlying-book-root-duplicate'
        log(json.dumps({'work': work, 'authors': authors, 'authorSource': author_source, 'hold': book_hold}))
        stored = f'raw/{work}-collection.xml'
        (OUT / stored).write_bytes(raw)
        license_source = SOURCE / 'raw' / f'{repo}-LICENSE'
        license_path = f'raw/{repo}-LICENSE'
        if not (OUT / license_path).exists():
            (OUT / license_path).write_bytes(license_source.read_bytes())
        for module in modules:
            module_bytes = (SOURCE / 'raw' / f'{work}-{module}.cnxml').read_bytes()
            node = ET.fromstring(module_bytes)
            content = next((item for item in node if item.tag.split('}')[-1] == 'content'), None)
            chapter_title = norm(''.join(next((item for item in node if item.tag.split('}')[-1] == 'title'), ET.Element('title')).itertext()))
            module_grant = next((item.attrib.get('url', '') for item in node.iter() if item.tag.split('}')[-1] == 'license'), '').replace('http://', 'https://')
            module_hold = book_hold or ('module-rights-exception' if module_grant and module_grant != BY else None)
            paragraphs = cnxml_paragraphs(content) if content is not None else []
            raw_path = f'raw/{work}-{module}.cnxml'
            canonical_path = f'raw/{work}-{module}.canonical.txt'
            canonical = '\n\n'.join(item['text'] for item in paragraphs)
            start = 0
            kept = 0
            module_rows = []
            for index, paragraph in enumerate(paragraphs):
                text = paragraph['text']
                digest = sha(text.encode())
                why = module_hold or reason(text, chapter_title, paragraph['excluded'])
                why = why or ('exact-text-existing-corpus' if digest in old else 'exact-text-duplicate-within-batch' if digest in seen else None)
                end = start + len(text)
                row = {'workId': work, 'rootId': root, 'chapter': chapter_title, 'locator': f'modules/{module}/index.cnxml',
                       'sourceUrl': f'https://github.com/openstax/{repo}/blob/{commit}/modules/{module}/index.cnxml',
                       'sourceHash': sha(module_bytes), 'rawPath': raw_path, 'canonicalPath': canonical_path,
                       'canonicalSha256': sha(canonical.encode()), 'paragraphIndex': index, 'start': start, 'end': end,
                       'textSha256': digest, 'text': text, 'wordCount': len(text.split())}
                if why:
                    holds.append({**row, 'reason': why})
                else:
                    row.update(id=sha(f'{work}\0{row["locator"]}\0{index}\0{text}'.encode()), licenceUrl=BY, preparationStatus='complete-source-paragraph-structural-ready')
                    module_rows.append(row)
                    seen[digest] = row['id']
                    kept += 1
                start = end + 2
            if module_rows:
                (OUT / raw_path).write_bytes(module_bytes)
                (OUT / canonical_path).write_text(canonical)
                rows.extend(module_rows)
            chapters.append({'workId': work, 'title': chapter_title, 'paragraphs': len(paragraphs), 'prepared': kept})
        ledger.append({'workId': work, 'rootId': root, 'title': title, 'authors': authors, 'authorSource': author_source,
                       'repository': repo, 'commit': commit, 'licenceUrl': BY, 'licenseSha256': sha((OUT / license_path).read_bytes()),
                       'licenseEvidencePath': license_path, 'collectionPath': stored, 'collectionSha256': sha(raw),
                       'modules': len(modules), 'language': language, 'acquiredAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                       'status': book_hold or 'frozen-cc-by-4-original-prose-pending-source-review'})
        print(json.dumps({'work': work, 'prepared': len(rows)}), flush=True)
        if len(rows) >= TARGET:
            break
    report = {'execution': 'actual owned Colab CPU reprepare of the same acquired CNXML', 'prepared': len(rows),
              'byWork': dict(Counter(row['workId'] for row in rows)), 'heldParagraphs': len(holds),
              'holdsByReason': dict(Counter(item['reason'] for item in holds)), 'sourceParagraphs': len(rows) + len(holds),
              'limits': 'Same cloud acquisition. Senior authors taken from the collection attribute or the preface senior-author section. Not full-book semantic review.'}
    for name, data in [('prepared.json', rows), ('source-ledger.json', ledger), ('chapters.json', chapters), ('report.json', report)]:
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False) + '\n')
    manifest = {str(path.relative_to(OUT)): {'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())} for path in OUT.rglob('*') if path.is_file()}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    archive = pathlib.Path('/content/lingfern-reading-bulk-authors-20261010.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=3) as zipper:
        for path in sorted(OUT.rglob('*')):
            if path.is_file():
                zipper.write(path, path.relative_to(OUT))
    print('AUTHORS_DONE ' + json.dumps({**report, 'archiveBytes': archive.stat().st_size, 'archiveSha256': sha(archive.read_bytes()), 'files': len(manifest)}), flush=True)

if __name__ == '__main__':
    try:
        run()
    except Exception:
        log(traceback.format_exc())
        raise
