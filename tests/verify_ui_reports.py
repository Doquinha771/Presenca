"""Verificação de interface offline, sem abrir rede real e sem dados escolares reais."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from zipfile import ZipFile
from io import BytesIO
root=Path(__file__).resolve().parents[1]
fixture=(root/'tests/browser-fixture.mjs').read_text().split('export const fixture=String.raw`',1)[1].rsplit('`;',1)[0]
base='https://presenca-ui-test.invalid/'
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for role,width in [('aluno',320),('aluno',390),('secretaria',390),('admin',390),('admin',1366)]:
  context=browser.new_context(viewport={'width':width,'height':900},accept_downloads=True)
  context.add_init_script(f'window.__testRole={role!r};')
  def fulfill(route):
   url=route.request.url
   if url.startswith('https://cdn.jsdelivr.net/'):
    return route.fulfill(status=200,content_type='text/javascript',body=fixture)
   path=url.split('.invalid/',1)[-1].split('#',1)[0].split('?',1)[0]
   path=path or 'index.html'
   file=(root/path).resolve()
   if not file.is_file() or not file.is_relative_to(root):return route.fulfill(status=404,body='not found')
   typ='text/javascript' if file.suffix=='.js' else 'text/css' if file.suffix=='.css' else 'image/webp' if file.suffix=='.webp' else 'image/png' if file.suffix=='.png' else 'text/html'
   return route.fulfill(status=200,content_type=typ,body=file.read_bytes())
  context.route('**/*',fulfill)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  for r in (['overview','history','announcements'] if role=='aluno' else ['overview','students','history','enrollments','reports'] if role=='secretaria' else ['overview','students','history','enrollments','reports','classes','announcements']):
   page.goto(base+'#/'+r)
   page.locator('#dashboard').wait_for(state='visible',timeout=14000)
   page.wait_for_function('!document.querySelector("#view").hasAttribute("aria-busy")')
   assert not page.locator('#view').get_by_text('Não foi possível carregar os dados',exact=True).count(),(role,width,r,page.locator('#view').inner_text()[:200])
   overflow=page.evaluate('document.documentElement.scrollWidth-innerWidth')
   assert overflow <= 1,(role,width,r,'overflow',overflow)
   assert page.locator('body.portal-layout').count()==1,(role,r,'no portal layout')
   if width<780: assert page.locator('#content>#mobileNav').count()==1,(role,width,r,'nav not unified')
   if r=='reports':
    assert page.locator('#reportForm').count()==1
    assert page.locator('#reportKind option').count()==3
    assert page.locator('[name="grade"] option').count()>=2
    assert page.locator('[name="class"] option').count()>=2
    page.locator('#reportKind').select_option('history')
    assert page.locator('[name="from"]').is_visible()
    page.locator('#reportKind').select_option('enrollments')
    assert not page.locator('[name="from"]').is_visible()
    # O dublê de autenticação não possui RPC real; somente o agregado antigo tem fixture.
   print('OK',role,width,r)
  context.close()
 assert not errors,errors
 browser.close()
print('VALIDAÇÃO UI PASSOU')
