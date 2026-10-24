"""Acquire five fixed official programme/audio pairs, preserving credits and rights/audio holds."""
import traceback, datetime, hashlib, json, pathlib, re, subprocess, time, urllib.request
ROOT = pathlib.Path('/content/lingfern-listening-20261009')
SOURCES = [
 ('noaa-rip-currents','noaa','oceans-water','https://oceanservice.noaa.gov/podcast/june23/nop66-rip-currents.html','https://oceanservice.noaa.gov/podcast/june23/nop66-rip-currents.mp3'),
 ('noaa-hurricane-response','noaa','earth-weather','https://oceanservice.noaa.gov/podcast/may24/nop74-hurricane-preparedness.html','https://oceanservice.noaa.gov/podcast/may24/nop74-nos-hurricane-response.mp3'),
 ('noaa-navigation-response','noaa','technology-engineering','https://oceanservice.noaa.gov/podcast/may26/nop83-navigation-response-team.html','https://oceanservice.noaa.gov/podcast/may26/nop83_NRTs_navigation_response.mp3'),
 ('noaa-monitor-mapping','noaa','history-heritage','https://oceanservice.noaa.gov/podcast/aug26/nop85-uss-monitor-3d-mapping.html','https://oceanservice.noaa.gov/podcast/aug26/nop85-uss-monitor-3d-mapping.mp3'),
 ('nasa-crew-13','nasa','space-astronomy','https://www.nasa.gov/podcasts/houston-we-have-a-podcast/crew-13/','https://www.nasa.gov/wp-content/uploads/2026/09/ep438-crew-13.mp3'),
]
RIGHTS = {'noaa':'https://oceanservice.noaa.gov/disclaimer.html','nasa':'https://www.nasa.gov/nasa-brand-center/images-and-media/'}
def digest(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()
def download(url, path, limit):
    from urllib.parse import urlparse
    assert urlparse(url).hostname in {'oceanservice.noaa.gov','www.nasa.gov'}
    if path.exists(): return
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Lingfern-public-corpus/1.0 (https://lingfern.com)'}),timeout=180) as response:
        assert urlparse(response.url).hostname in {'oceanservice.noaa.gov','cdn.oceanservice.noaa.gov','www.nasa.gov'}, 'UNVERIFIED_REDIRECT'
        if urlparse(response.url).hostname=='cdn.oceanservice.noaa.gov': assert urlparse(response.url).path.startswith('/oceanserviceprod/podcast/'), 'UNVERIFIED_AUDIO_PATH'
        with path.open('xb') as stream:
            size=0
            while chunk:=response.read(1048576):
                size+=len(chunk)
                if size>limit: raise ValueError('SOURCE_TOO_LARGE')
                stream.write(chunk)
def run():
    from bs4 import BeautifulSoup
    output=ROOT/'agency';output.mkdir(exist_ok=True);rows=[];started=time.perf_counter()
    for family,url in RIGHTS.items():download(url,output/(family+'-rights.html'),3000000)
    for identity,family,topic,url,audio in SOURCES:
        row={'id':identity,'family':family,'topicHint':topic,'sourceUrl':url,'audioUrl':audio,'rightsUrl':RIGHTS[family],
             'reviewStatus':'pending','rightsAcceptance':'pending-specific-voices-music-and-third-party-scope','audioAcceptance':'not-auditorily-accepted'}
        try:
            html=output/(identity+'.html');mp3=output/(identity+'.mp3');download(url,html,5000000);download(audio,mp3,80000000)
            html_text=html.read_text()
            if family=='noaa':
                heading=re.search(r'<h[23]\b[^>]*>\s*Transcript\s*</h[23]>',html_text,re.I)
                assert heading is not None, 'TRANSCRIPT_HEADING'
                end=html_text.index('<!--sidebar-->',heading.end())
            else:
                heading=re.search(r'<p><strong>Transcript</strong></p>',html_text,re.I)
                assert heading is not None, 'TRANSCRIPT_HEADING'
                end=html_text.index('<footer',heading.end())
            soup=BeautifulSoup(html_text[heading.end():end],'html.parser')
            paragraphs=[element.get_text(' ',strip=True)for element in soup.find_all('p')if not element.find('img')]
            assert len(paragraphs)>10, 'TRANSCRIPT_SCOPE'
            text='\n\n'.join(paragraphs);transcript=output/(identity+'.official-page.txt');transcript.write_text(text)
            probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=sample_rate,channels,codec_name','-of','json',str(mp3)]))
            subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-i',str(mp3),'-f','null','-'],capture_output=True,check=True)
            row.update({'sourceHtmlPath':str(html.relative_to(ROOT)),'sourceHtmlSha256':digest(html),'textPath':str(transcript.relative_to(ROOT)),
                'textSha256':digest(transcript),'text':text,'audioPath':str(mp3.relative_to(ROOT)),'audioSha256':digest(mp3),'audioBytes':mp3.stat().st_size,
                'transcriptSourceCharStart':heading.end(),'transcriptSourceCharEnd':end,'probe':probe,'duration':float(probe['format']['duration']),'credits':[line for line in text.splitlines() if re.search(r'music|copyright|credit|Roscosmos|Canadian Space|CSA',line,re.I)],
                'processing':'Complete paragraph elements within exact Transcript-to-sidebar/footer HTML bounds, excluding image paragraphs; original words/speaker labels and credits retained; exact scope remains reviewable. No source media/images/scripts exported as website content.',
                'rootBoundary':'hurricane-rebroadcast-same-original-root' if identity=='noaa-hurricane-response' else 'original-programme-scope-pending'})
        except Exception as error:row['error']=type(error).__name__+': '+str(error);row['traceback']=traceback.format_exc()
        rows.append(row);print(identity,'acquired' if 'error' not in row else row['error'],flush=True)
    (ROOT/'agency-prepared-final-reviewed.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
    report={'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'requested':len(SOURCES),'downloadedDecoded':sum('error' not in row for row in rows),
            'failures':sum('error' in row for row in rows),'families':sorted({row['family'] for row in rows if 'error' not in row}),
            'hours':sum(row.get('duration',0) for row in rows)/3600,'wallSeconds':time.perf_counter()-started,'accepted':0}
    (ROOT/'agency-prepared-final-reviewed-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
if __name__=='__main__':run()
