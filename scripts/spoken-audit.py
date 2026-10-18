"""Optional local acquisition audit; not a website or deployment dependency."""
import collections
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import runpy
import sys

root = Path(__file__).resolve().parents[1]
directory = root / 'private/corpus/spoken'
script = Path.home() / '.codex/skills/mlx-audio-notes/scripts/transcribe.py'
model = 'mlx-community/whisper-large-v3-turbo'
revision = (Path.home() / '.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/refs/main').read_text().strip()
state = json.loads((directory / 'processed.json').read_text())
limit = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
if not 1 <= limit <= 3000:
    raise ValueError('INVALID_LIMIT')
rows = []
for item in state['records'][:limit]:
    audio = directory / 'audio' / f"{item['fileId']}.ogg"
    try:
        # Reuse the installed skill verbatim, including its hash/parameter cache.
        sys.argv = [str(script), str(audio), '--language', 'en', '--model', model]
        try:
            runpy.run_path(str(script), run_name='__main__')
        except SystemExit as error:
            if error.code not in (0, None):
                raise RuntimeError('TRANSCRIPTION_FAILED') from error
        result = json.loads(audio.with_name(audio.stem + '.transcript.json').read_text())
        with audio.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if result['_source'] != {'sha256': digest, 'model': model, 'language': 'en'} or digest != item['audioSha256']:
            raise ValueError('TRANSCRIPT_SOURCE_MISMATCH')
        tokens = lambda text: re.findall(r"[a-z]+(?:'[a-z]+)?", text.lower().replace('’', "'"))
        spoken = tokens(result['text'])
        original = tokens(item['text'])
        if len(spoken) < 20 or not result.get('segments'):
            raise ValueError('INSUFFICIENT_TRANSCRIPTION')
        source_grams = {tuple(original[index:index + 3]) for index in range(len(original) - 2)}
        spoken_grams = [tuple(spoken[index:index + 3]) for index in range(len(spoken) - 2)]
        overlap = sum(gram in source_grams for gram in spoken_grams) / len(spoken_grams)
        repetitions = collections.Counter(tuple(spoken[index:index + 8]) for index in range(max(0, len(spoken) - 7)))
        flags = list(item.get('qualityFlags', []))
        if overlap < 0.65:
            flags.append('low automatic lexical overlap; source/recording/ASR review required')
        if repetitions and max(repetitions.values()) >= 8:
            flags.append('repeated ASR phrase; inspect hallucination or genuine repetition')
        if any(segment['start'] < 0 or segment['end'] < segment['start'] or segment['end'] > item.get('decodedDuration', item['duration']) + 2 for segment in result['segments']):
            flags.append('ASR timestamp outside recording')
        rows.append({'fileId': item['fileId'], 'articlePageId': item['articlePageId'], 'audioSha256': digest, 'model': model, 'modelRevision': revision, 'language': 'en', 'recognizedWords': len(spoken), 'sourceWords': len(original), 'lexicalOverlap': round(overlap, 4), 'flags': flags, 'reviewStatus': 'pending'})
    except Exception as error:
        rows.append({'fileId': item['fileId'], 'error': str(error), 'reviewStatus': 'pending'})
    # A bounded batch checkpoint, not a watcher or a scheduled job.
    (directory / 'asr-audit.json.tmp').write_text(json.dumps({'records': rows}, indent=2))
    (directory / 'asr-audit.json.tmp').replace(directory / 'asr-audit.json')
    report = {'updatedAt': datetime.now(timezone.utc).isoformat(), 'requestedLimit': limit, 'availableSourcePairs': len(state['records']), 'audited': len(rows), 'complete': len(rows) == min(limit, len(state['records'])), 'transcriptionFailures': sum('error' in row for row in rows), 'qualityFlagged': sum(bool(row.get('flags')) for row in rows), 'model': model, 'modelRevision': revision, 'humanReviewed': 0, 'approvedListeningTasks': 0, 'note': 'Automatic source/audio matching diagnostics, not validated transcripts, language-ability estimates or editorial approval.'}
    report_path = root / 'content/corpus/spoken-audit-report.json'
    temporary = report_path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(report, indent=2) + '\n')
    temporary.replace(report_path)
print(json.dumps(report))
