"""Gera os modelos de e-mail do Supabase Auth em supabase/templates/.

Uso: python scripts/emails.py
Depois, copie cada arquivo para Supabase > Authentication > Emails (veja docs/EMAILS_SUPABASE.md).

Os botões levam direto ao portal com o código do link (token_hash). O próprio site confere o código,
então o link funciona mesmo que a "Site URL" do projeto esteja errada.
"""
import io
import os

SITE = 'https://doquinha771.github.io/Presenca/'
ESCOLA = 'E.E. Amador e Catharina Saporito Augusto'
AZUL, AZUL_ESCURO, VERMELHO, TINTA, CINZA, FUNDO = '#0a4fa3', '#083d80', '#c8102e', '#141b2d', '#5b6478', '#eef3fa'
FONTE = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def link(tipo):
    return f'{SITE}?token_hash={{{{ .TokenHash }}}}&type={tipo}'


def botao(texto, url):
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px">'
            f'<tr><td style="border-radius:12px;background:{AZUL}">'
            f'<a href="{url}" style="display:inline-block;padding:15px 28px;border-radius:12px;background:{AZUL};'
            f'color:#ffffff;font-family:{FONTE};font-size:16px;font-weight:700;text-decoration:none">{texto}</a>'
            f'</td></tr></table>')


def reserva(url):
    return (f'<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:{CINZA}">O botão não funcionou? '
            f'Copie e cole este endereço no navegador:<br><a href="{url}" style="color:{AZUL};word-break:break-all">{url}</a></p>')


def aviso(texto):
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px">'
            f'<tr><td style="padding:12px 14px;border-radius:10px;background:#fff7e0;border:1px solid #f3dc9a;'
            f'font-family:{FONTE};font-size:13px;line-height:1.5;color:#6b4f00">{texto}</td></tr></table>')


def codigo():
    return (f'<p style="margin:24px 0 6px;text-align:center"><span style="display:inline-block;padding:14px 22px;'
            f'border-radius:12px;background:{FUNDO};border:1px dashed {AZUL};font-family:Consolas,Menlo,monospace;'
            f'font-size:30px;font-weight:700;letter-spacing:8px;color:{AZUL_ESCURO}">{{{{ .Token }}}}</span></p>')


def pagina(titulo, previa, emoji, chamada, corpo):
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>{titulo}</title>
</head>
<body style="margin:0;padding:0;background:{FUNDO}">
<!-- Texto de prévia que aparece na caixa de entrada -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{previa}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{FUNDO}">
<tr><td align="center" style="padding:28px 14px">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
  <tr><td style="padding:0 4px 14px;font-family:{FONTE}">
   <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:10px"><img src="{SITE}assets/logo.png" width="40" height="40" alt="" style="display:block;border-radius:10px;border:0"></td>
    <td style="font-family:{FONTE};font-size:20px;font-weight:800;color:{TINTA}">Presença<span style="color:{VERMELHO}">+</span></td>
   </tr></table>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;border:1px solid #dfe6f1;overflow:hidden">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:6px;line-height:6px;font-size:0;background:{AZUL};border-radius:18px 18px 0 0">&nbsp;</td></tr>
    <tr><td style="padding:30px 30px 32px;font-family:{FONTE};color:{TINTA}">
     <p style="margin:0 0 6px;font-size:34px;line-height:1">{emoji}</p>
     <h1 style="margin:10px 0 10px;font-size:23px;line-height:1.3;color:{TINTA}">{titulo}</h1>
     <p style="margin:0;font-size:16px;line-height:1.6;color:#2b3448">{chamada}</p>
     {corpo}
    </td></tr>
   </table>
  </td></tr>
  <tr><td style="padding:18px 8px 0;font-family:{FONTE};font-size:12px;line-height:1.6;color:{CINZA};text-align:center">
   Presença+ · {ESCOLA}<br>
   Projeto feito por alunos para acompanhar os atrasos da escola.<br>
   Este é um e-mail automático, não precisa responder.
  </td></tr>
 </table>
</td></tr>
</table>
</body>
</html>
'''


IGNORE = 'Não foi você que pediu? Pode ignorar este e-mail: nada muda na sua conta.'
MODELOS = {
    'confirmar-cadastro.html': ('Confirme seu cadastro no Presença+', 'Falta só um clique para ativar sua conta.', '✉️',
        'Oi! Recebemos o cadastro do e-mail <strong>{{ .Email }}</strong>. Toque no botão para confirmar que este e-mail é seu.',
        botao('Confirmar meu e-mail', link('email')) + reserva(link('email'))
        + aviso('Se a escola já tiver sua matrícula, o acesso é liberado assim que você confirmar. ' + IGNORE)),
    'redefinir-senha.html': ('Vamos criar uma nova senha', 'Use o botão para escolher uma nova senha.', '🔑',
        'Alguém pediu para trocar a senha da conta <strong>{{ .Email }}</strong>. Toque no botão e escolha a nova senha no portal.',
        botao('Criar nova senha', link('recovery')) + reserva(link('recovery'))
        + aviso('O link vale por pouco tempo e só pode ser usado uma vez. ' + IGNORE + ' Sua senha atual continua valendo.')),
    'convite.html': ('Você foi convidado para o Presença+', 'A Direção liberou seu acesso à equipe.', '🏫',
        'A Direção da escola liberou um acesso para <strong>{{ .Email }}</strong>. Toque no botão para aceitar o convite e criar sua senha.',
        botao('Aceitar convite', link('invite')) + reserva(link('invite'))
        + aviso('Não esperava este convite? Ignore este e-mail e avise a secretaria.')),
    'link-de-acesso.html': ('Seu link para entrar', 'Entre no Presença+ sem digitar a senha.', '🚪',
        'Toque no botão para entrar no Presença+ com <strong>{{ .Email }}</strong>.',
        botao('Entrar no Presença+', link('email')) + reserva(link('email'))
        + aviso('O link vale por pouco tempo e só pode ser usado uma vez. ' + IGNORE)),
    'trocar-email.html': ('Confirme seu novo e-mail', 'Confirme a troca de e-mail da sua conta.', '📬',
        'Foi pedida a troca do e-mail da conta de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>. Toque no botão para confirmar.',
        botao('Confirmar novo e-mail', link('email_change')) + reserva(link('email_change'))
        + aviso('Não pediu essa troca? Ignore este e-mail e avise a secretaria da escola.')),
    'codigo-de-confirmacao.html': ('Seu código de confirmação', 'Use este código para confirmar a ação no portal.', '🔢',
        'Use o código abaixo no Presença+ para confirmar que é você mesmo.',
        codigo() + aviso('O código vale por pouco tempo. Nunca passe este código para outra pessoa, nem para alguém da escola. ' + IGNORE)),
    'aviso-senha-alterada.html': ('Sua senha foi alterada', 'A senha da sua conta acabou de mudar.', '✅',
        'A senha da conta <strong>{{ .Email }}</strong> foi alterada agora há pouco.',
        aviso('Foi você? Então está tudo certo. Não foi você? Use “Esqueci a senha” no portal para criar outra e avise a secretaria.')),
    'aviso-email-alterado.html': ('O e-mail da sua conta mudou', 'O e-mail de acesso da sua conta foi trocado.', 'ℹ️',
        'O e-mail de acesso que era <strong>{{ .OldEmail }}</strong> agora é <strong>{{ .Email }}</strong>.',
        aviso('Não reconhece essa troca? Procure a secretaria da escola o quanto antes.')),
}

if __name__ == '__main__':
    pasta = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'templates')
    os.makedirs(pasta, exist_ok=True)
    for nome, (titulo, previa, emoji, chamada, corpo) in MODELOS.items():
        with io.open(os.path.join(pasta, nome), 'w', encoding='utf-8', newline='\n') as f:
            f.write(pagina(titulo, previa, emoji, chamada, corpo))
    print(f'{len(MODELOS)} modelos gerados em supabase/templates/')
