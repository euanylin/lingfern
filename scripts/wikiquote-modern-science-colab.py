import pathlib,urllib.request,json,hashlib,xml.etree.ElementTree as ET,re,zipfile,datetime
out=pathlib.Path('/content/lingfern-modern-quotes/science');out.mkdir(exist_ok=True)
urls=['https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8018278/fullTextXML','https://history.nasa.gov/rogersrep/v2appf.htm','https://www.nasa.gov/about/highlights/what_does_nasa_do.html','https://www.nasa.gov/nasa-brand-center/images-and-media/']
results=[]
for url in urls:
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Lingfern-public-source-research/0.1; lingfern.com'}),timeout=30)as r:data=r.read(12*1024*1024+1);assert len(data)<=12*1024*1024;final=r.url
  name=hashlib.sha256(url.encode()).hexdigest();(out/(name+'.raw')).write_bytes(data)
  row={'url':url,'finalUrl':final,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'name':name+'.raw'}
  if 'fullTextXML' in url:
   tree=ET.fromstring(data);row['licence']=[''.join(x.itertext())for x in tree.findall('.//license')];row['title']=''.join(tree.find('.//article-title').itertext());row['years']=[x.text for x in tree.findall('.//pub-date/year')];row['doi']=[x.text for x in tree.findall('.//article-id')if x.get('pub-id-type')=='doi'];row['sample']=[(''.join(x.itertext()))for x in tree.findall('.//body//p')if 'Individuals of some animal' in ''.join(x.itertext())]
  else:row['sample']=re.sub('<[^>]+>',' ',data.decode('utf8',errors='replace'))[:400]
  results.append(row)
 except Exception as e:results.append({'url':url,'error':str(e)})
(out/'report.json').write_text(json.dumps({'cloudRuntime':'lingfern-modern-quotes-20261012','executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':results},indent=2)+'\n')
p=pathlib.Path('/content/modern-science.zip')
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED)as z:
 for f in out.iterdir():z.write(f,f.name)
pathlib.Path('/content/modern-science-manifest.json').write_text(json.dumps({'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()},indent=2)+'\n');print(json.dumps(results))
