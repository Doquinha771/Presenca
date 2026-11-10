"""Teste de navegador local, sem comunicação com o Supabase real."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
from zipfile import ZipFile
import re

root=Path(__file__).resolve().parents[1]
source=(root/'tests/browser-fixture.mjs').read_text(encoding='utf-8')
fixture=source.split('export const fixture=String.raw`',1)[1].rsplit('`;',1)[0]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
checks=[]
try:
 with sync_playwright() as playwright:
  browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for role,width in [('admin',1366),('secretaria',390),('aluno',390)]:
   context=browser.new_context(viewport={'width':width,'height':844},accept_downloads=True)
   context.add_init_script(f"window.__testRole = {role!r};")
   context.route('https://cdn.jsdelivr.net/**',lambda route: route.fulfill(status=200,content_type='text/javascript',body=fixture))
   page=context.new_page()
   errors=[]
   page.on('pageerror',lambda error: errors.append(str(error)))
   page.goto(base+'#/reports',wait_until='domcontentloaded')
   page.locator('#dashboard').wait_for(state='visible',timeout=15000)
   page.wait_for_function('document.querySelector("#view") && !document.querySelector("#view").hasAttribute("aria-busy")')
   if role=='aluno':
    assert page.locator('[data-action="export-report"]').count()==0
    assert page.locator('#nav [data-page="reports"]').count()==0
    assert page.locator('#nav a.active').get_attribute('data-page')=='overview'
    checks.append('aluno: exportação e rota de relatórios inacessíveis')
   else:
    assert page.locator('[data-action="export-report"]').count()==1
    assert page.locator('#importForm').count()==0
    assert page.locator('#nav [data-page="importer"]').count()==0
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
    with page.expect_download(timeout=15000) as received:
     page.locator('[data-action="export-report"]').click()
    download=received.value
    assert download.suggested_filename.endswith('.xlsx')
    out=root/'tests'/f'check-{role}.xlsx'
    download.save_as(str(out))
    with ZipFile(out) as workbook:
     assert workbook.testzip() is None
     assert len([f for f in workbook.namelist() if 'worksheets/sheet' in f])==3
     all_content='\n'.join(workbook.read(f).decode('utf8') for f in workbook.namelist())
     assert not any(secret in all_content for secret in ('João Pedro da Silva','0000111','<img src','Maria da Secretaria'))
     assert '3º ano • A' in all_content
    out.unlink()
    checks.append(f'{role}/{width}px: exportação XLSX válida, sem dados individuais e sem importação')
   assert not errors,errors
   context.close()
  browser.close()
finally:
 server.shutdown()
for c in checks:print('OK',c)
print('BROWSER CHECKS PASSED:',len(checks))
