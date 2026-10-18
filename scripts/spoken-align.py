"""Private exact-token alignment candidates; no editorial or proficiency approval."""
import hashlib
import json
from pathlib import Path
import re
import sys


def tokens(text):
    return list(re.finditer(r"[a-z]+(?:['’][a-z]+)?|[0-9]+(?:[.,][0-9]+)*", text, re.I))


def align(text, segments, duration):
    source = tokens(text)
    words = [match.group().lower().replace('’', "'") for match in source]
    anchors = {}
    for index in range(max(0, len(words) - 4)):
        anchors.setdefault(tuple(words[index:index + 5]), []).append(index)
    result = []
    last_end = 0
    last_audio = 0
    for segment in segments:
        spoken = [match.group().lower().replace('’', "'") for match in tokens(segment['text'])]
        start, end = segment['start'], segment['end']
        if not 5 <= len(spoken) <= 60 or not 0 <= start < end <= duration or start < last_audio:
            continue
        matches = [index for index in anchors.get(tuple(spoken[:5]), [])
                   if words[index:index + len(spoken)] == spoken]
        if len(matches) != 1:
            continue
        index = matches[0]
        begin, finish = source[index].start(), source[index + len(spoken) - 1].end()
        if begin < last_end:
            continue
        result.append({'start': len(text[:begin].encode('utf-16-le')) // 2,
                       'end': len(text[:finish].encode('utf-16-le')) // 2,
                       'text': text[begin:finish],
                       'audioStart': start, 'audioEnd': end})
        last_end, last_audio = finish, end
    return result


def audit_flags(item, data, audit):
    if (not audit or audit.get('error') or audit.get('audioSha256') != item['audioSha256']
        or audit.get('model') != data['_source']['model'] or audit.get('language') != 'en'
        or not isinstance(audit.get('flags'), list)
        or any(not isinstance(flag, str) or not flag for flag in audit['flags'])):
        raise ValueError('AUDIO_AUDIT_INTEGRITY')
    return sorted(set(item['qualityFlags'] + audit['flags']))


def main():
    root = Path(__file__).resolve().parents[1]
    directory = root / 'private/corpus/spoken'
    source = json.loads((directory / 'processed.json').read_text())
    audits = json.loads((directory / 'asr-audit.json').read_text())['records']
    by_file = {row['fileId']: row for row in audits}
    if len(by_file) != len(audits):
        raise ValueError('DUPLICATE_AUDIO_AUDIT')
    rows = []
    for item in source['records']:
        transcript = directory / 'audio' / f"{item['fileId']}.transcript.json"
        if not transcript.exists():
            continue
        data = json.loads(transcript.read_text())
        if (data.get('_source', {}).get('sha256') != item['audioSha256']
                or data.get('_source', {}).get('language') != 'en'):
            continue
        if hashlib.sha256(item['text'].encode()).hexdigest() != item['textSha256']:
            raise ValueError('SOURCE_TEXT_INTEGRITY')
        audit = by_file.get(item['fileId'])
        flags = audit_flags(item, data, audit)
        candidates = align(item['text'], data.get('segments', []), item['decodedDuration'])
        if candidates:
            rows.append({'rootId': item['rootId'], 'fileId': item['fileId'],
                         'textSha256': item['textSha256'], 'audioSha256': item['audioSha256'],
                         'model': data['_source']['model'], 'modelRevision': audit['modelRevision'], 'reviewStatus': 'pending',
                         'qualityFlags': flags, 'alignmentStatus': 'automatic candidate',
                         'offsetUnit': 'utf16-code-units',
                         'provenance': {key: item[key] for key in (
                             'title', 'articleUrl', 'authorHistoryUrl', 'textLicence',
                             'textLicenceUrl', 'textAttribution', 'audioSourceUrl',
                             'licence', 'licenceUrl', 'artistHtml', 'creditHtml',
                             'audioRightsEvidenceUrl', 'processing')},
                         'segments': candidates})
    target = directory / 'alignment-candidates.json'
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps({'version': 1, 'records': rows}))
    temporary.replace(target)
    print(json.dumps({'sourcePairs': len(source['records']), 'matchedRoots': len(rows),
                      'candidateSegments': sum(len(row['segments']) for row in rows),
                      'humanReviewed': 0, 'published': False}))


if __name__ == '__main__':
    if '--test' in sys.argv:
        text = 'One clear sentence contains five words. Another exact source phrase appears here.'
        parts = [{'text': 'One clear sentence contains five words.', 'start': 1, 'end': 3},
                 {'text': 'Another exact source phrase appears here.', 'start': 4, 'end': 7}]
        found = align(text, parts, 8)
        assert len(found) == 2 and all(text[row['start']:row['end']] == row['text'] for row in found)
        assert not align(text, [{**parts[0], 'end': 9}], 8)
        assert not align(text + ' ' + text, parts, 8)
        assert not align(text, [{**parts[0], 'text': 'One fabricated sentence contains five words.'}], 8)
        assert len(align(text, parts[::-1], 8)) == 1
        numeric = 'The expedition returned in 1991 with five people.'
        wrong = [{'text': numeric.replace('1991', '1992'), 'start': 1, 'end': 3}]
        assert not align(numeric, wrong, 8)
        assert len(align(numeric, [{**wrong[0], 'text': numeric}], 8)) == 1
        shifted = align('🌿 ' + text, parts, 8)
        assert shifted[0]['start'] == 3
        utf16 = ('🌿 ' + text).encode('utf-16-le')
        assert all(utf16[row['start'] * 2:row['end'] * 2].decode('utf-16-le') == row['text'] for row in shifted)
        item = {'audioSha256': 'a' * 64, 'qualityFlags': ['source diagnostic']}
        data = {'_source': {'model': 'local'}}
        audit = {'audioSha256': 'a' * 64, 'model': 'local', 'language': 'en', 'flags': ['ASR diagnostic', 'source diagnostic']}
        assert audit_flags(item, data, audit) == ['ASR diagnostic', 'source diagnostic']
        for broken in (None, {**audit, 'audioSha256': 'b' * 64}, {**audit, 'flags': ['']}, {**audit, 'error': 'failed'}):
            try:
                audit_flags(item, data, broken)
                raise AssertionError('Unverified audit accepted')
            except ValueError:
                pass
        print('PASS exact source spans, duplicate rejection, hallucination, numeric meaning, UTF-16 offsets, timing and order bounds')
    else:
        main()
