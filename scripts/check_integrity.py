from pathlib import Path
from bs4 import BeautifulSoup
import re
root=Path(__file__).resolve().parent.parent
for name in ('termos.html','privacidade.html','index.html'):
 text=(root/name).read_text('utf-8')
 soup=BeautifulSoup(text,'html.parser')
 assert soup.html and soup.html.get('lang')=='pt-BR'
 assert soup.title and soup.select_one('meta[http-equiv="Content-Security-Policy"]')
 for a in soup.select('a[href]'):
  href=a['href']
  if href.startswith('./'):
   assert (root / href.split('#')[0]).exists(),(name,href)
 if name!='index.html':
  assert not soup.select('script,iframe,form')
  for a in soup.select('aside.contents a[href^="#"]'):
   assert soup.select_one('[id="'+a['href'][1:]+'"]')
  assert not re.search('minuta|validar com a instituição|aguardando identificação',soup.get_text(' ',strip=True),re.I)
 print(f'{name}: estrutura e links internos OK')
assert '## Instalação' not in (root/'README.md').read_text()
print('README sem seção de instalação: OK')
