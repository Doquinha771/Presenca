# Convida geu01 e Tessias como contribuidores do repositório Doquinha771/Presenca.
#
# Antes de rodar, uma única vez, instale e entre no GitHub CLI com a conta dona do repositório:
#   winget install --id GitHub.cli -e
#   gh auth login
#
# Para rodar, na pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File scripts\adicionar-contribuidores.ps1
#
# Cada pessoa recebe um convite e precisa aceitar em https://github.com/notifications.
# "push" permite enviar alterações ao código. Use "triage" se a pessoa só for organizar issues.
$permissao = 'push'
foreach ($pessoa in 'geu01', 'Tessias') {
  gh api --method PUT "repos/Doquinha771/Presenca/collaborators/$pessoa" -f "permission=$permissao" | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Output "Convite enviado para $pessoa." } else { Write-Output "Não foi possível convidar $pessoa." }
}
