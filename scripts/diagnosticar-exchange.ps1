# scripts/diagnosticar-exchange.ps1
# ------------------------------------------------------------------
# Diz POR QUE o cmdlet New-ServicePrincipal nao aparece na sessao do
# Exchange Online (passo 4 da configuracao de e-mail — ver README).
#
# Existe porque o Exchange Online PowerShell V3 NAO carrega os cmdlets
# que o usuario nao tem permissao de rodar: falta de RBAC aparece como
# "nao foi reconhecido", exatamente igual a modulo ausente ou sessao
# desconectada. Os tres problemas tem a mesma mensagem e correcoes
# completamente diferentes, entao vale testar na ordem.
#
# Uso: cole o conteudo numa janela do PowerShell, ou
#      .\scripts\diagnosticar-exchange.ps1
# ------------------------------------------------------------------

$mod = Get-Module ExchangeOnlineManagement -ListAvailable |
       Sort-Object Version -Descending | Select-Object -First 1

if (-not $mod) {
  Write-Host "CAUSA: o modulo ExchangeOnlineManagement NAO esta instalado." -ForegroundColor Red
  Write-Host "Rode: Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser -Force"
  return
}

Write-Host "Modulo instalado: versao $($mod.Version)"

if ($mod.Version.Major -lt 3) {
  Write-Host "CAUSA: modulo antigo (New-ServicePrincipal exige a 3.x)." -ForegroundColor Red
  Write-Host "Rode: Install-Module -Name ExchangeOnlineManagement -Force"
  return
}

# A conexao vale SO para a janela onde Connect-ExchangeOnline rodou, e
# expira com cerca de 1h de inatividade — a causa mais comum de todas.
$conn = $null
try { $conn = Get-ConnectionInformation -ErrorAction Stop } catch { }

if (-not $conn) {
  Write-Host "CAUSA: a sessao NAO esta conectada ao Exchange Online." -ForegroundColor Red
  Write-Host "Rode NESTA MESMA janela:"
  Write-Host "  Connect-ExchangeOnline -UserPrincipalName <seu-admin@dominio>"
  return
}

Write-Host "Conectado como: $($conn.UserPrincipalName)"
Write-Host "Tenant: $($conn.TenantId)"

if (Get-Command New-ServicePrincipal -ErrorAction SilentlyContinue) {
  Write-Host "OK - o cmdlet existe nesta sessao. Pode seguir com o passo 4." -ForegroundColor Green
  return
}

Write-Host "CAUSA: conectado, mas SEM o papel RBAC que carrega o cmdlet." -ForegroundColor Red
Write-Host "$($conn.UserPrincipalName) precisa de 'Role Management', incluso em"
Write-Host "Administrador do Exchange / Organization Management."
Write-Host "Ser Administrador Global do M365 NAO basta por si so."
Write-Host ""
Write-Host "Quem hoje tem esse papel:"

Get-ManagementRole -Cmdlet New-ServicePrincipal | ForEach-Object {
  Get-ManagementRoleAssignment -Role $_.Name -Delegating $false |
    Select-Object RoleAssigneeName, Role
} | Format-Table -Auto
