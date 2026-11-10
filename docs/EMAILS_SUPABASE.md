# E-mails do Supabase e troca de senha

## Por que o link de trocar senha abria "localhost"

O Supabase monta o link do e-mail usando a **Site URL** do projeto. Quando ela fica no valor padrão
(`http://localhost:3000`), ou quando o endereço do portal não está na lista de redirecionamentos permitidos,
quem clica no e-mail cai numa página de erro do próprio computador.

A partir da versão 5.4.9:

1. Os modelos de e-mail em `supabase/templates/` levam direto ao portal com o código do link (`token_hash`).
2. O portal confere o código sozinho (`verifyOtp`) e abre a tela certa:
   - trocar senha e convite → tela **Definir nova senha**;
   - confirmar cadastro, link de acesso e troca de e-mail → entra no portal.
3. Link vencido ou já usado mostra **"Este link expirou ou já foi usado"** e abre a tela para pedir outro.

## Passo 1: endereço do portal (Authentication › URL Configuration)

- **Site URL:** `https://doquinha771.github.io/Presenca/`
- **Redirect URLs:** adicione `https://doquinha771.github.io/Presenca/**`

Mesmo com os modelos novos, deixe isso certo: alguns e-mails do Supabase ainda usam a Site URL.

## Passo 2: modelos (Authentication › Emails › Templates)

O Supabase só deixa editar os modelos depois de configurar um **SMTP próprio**
(Authentication › Emails › SMTP Settings). Sem isso, ele usa os modelos padrão em inglês; com a Site URL
e a Redirect URL do passo 1 certas, os links padrão também funcionam (o portal abre a tela de nova senha).

Com o SMTP configurado, em cada modelo, troque o **Assunto** e cole o conteúdo do arquivo no campo **Message body** (modo código/Source).

| Modelo no Supabase | Assunto | Arquivo |
| --- | --- | --- |
| Confirm signup | Confirme seu cadastro no Presença+ | `confirmar-cadastro.html` |
| Invite user | Você foi convidado para o Presença+ | `convite.html` |
| Magic Link | Seu link para entrar no Presença+ | `link-de-acesso.html` |
| Change Email Address | Confirme seu novo e-mail | `trocar-email.html` |
| Reset Password | Crie uma nova senha no Presença+ | `redefinir-senha.html` |
| Reauthentication | Seu código de confirmação | `codigo-de-confirmacao.html` |

Avisos de segurança (Authentication › Emails › Security notifications), se o seu plano mostrar essa área:

| Aviso | Assunto | Arquivo |
| --- | --- | --- |
| Password changed | Sua senha do Presença+ foi alterada | `aviso-senha-alterada.html` |
| Email address changed | O e-mail da sua conta mudou | `aviso-email-alterado.html` |

## Mudou o endereço do site?

Troque `SITE` em `scripts/emails.py`, rode `python scripts/emails.py` e cole os modelos de novo.

## Envio de e-mails

O servidor de e-mail padrão do Supabase tem limite baixo de envios por hora e pode só entregar para
endereços da equipe do projeto. Para os alunos receberem sempre, configure um SMTP próprio em
Authentication › Emails › SMTP Settings (por exemplo, a conta de e-mail da escola ou um serviço de envio).
