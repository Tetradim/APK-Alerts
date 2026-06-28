#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$InstallRoot = "$env:LOCALAPPDATA\MobileConsolidation",
    [string]$ConsolidationRepoUrl = "https://github.com/Tetradim/Consolidation.git",
    [int]$ApiPort = 8003,
    [string]$TailscaleAuthKey = $env:TAILSCALE_AUTHKEY,
    [string]$MobileApiKey = $env:MOBILE_CONSOLIDATION_API_KEY,
    [switch]$SkipTailscaleInstall,
    [switch]$SkipTailscaleConnect,
    [string]$EvidencePath = ""
)

$ErrorActionPreference = "Stop"

function New-MobileApiKey {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-PairingDeepLink {
    param([object]$Payload)

    $json = $Payload | ConvertTo-Json -Depth 8 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $encoded = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
    return "apkalerts://pair?payload=$encoded"
}

function Resolve-TailscaleExe {
    $command = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidate = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
    if (Test-Path $candidate) {
        return $candidate
    }

    return ""
}

function Install-TailscaleIfNeeded {
    if (Resolve-TailscaleExe) {
        return $true
    }

    if ($SkipTailscaleInstall) {
        Write-Warning "Tailscale is not installed and -SkipTailscaleInstall was supplied."
        return $false
    }

    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Warning "winget is unavailable. Install Tailscale manually, then rerun this script."
        return $false
    }

    & winget install --id Tailscale.Tailscale --exact --source winget --silent --accept-package-agreements --accept-source-agreements
    return [bool](Resolve-TailscaleExe)
}

function Connect-TailscaleIfConfigured {
    $tailscale = Resolve-TailscaleExe
    if (-not $tailscale) {
        return @{ loggedIn = $false; ip = ""; dnsName = "" }
    }

    if ($TailscaleAuthKey -and -not $SkipTailscaleConnect) {
        Write-Host "Running tailscale up --auth-key <redacted>"
        & $tailscale up --auth-key $TailscaleAuthKey --accept-routes=false
    }

    $ip = ""
    $dnsName = ""
    try {
        $ip = (& $tailscale ip -4 2>$null | Select-Object -First 1).Trim()
    } catch {
        $ip = ""
    }
    try {
        $statusJson = & $tailscale status --json 2>$null | ConvertFrom-Json
        $dnsName = [string]$statusJson.Self.DNSName
    } catch {
        $dnsName = ""
    }

    return @{
        loggedIn = [bool]($ip -or $dnsName)
        ip = $ip
        dnsName = $dnsName
    }
}

function Ensure-ConsolidationRepo {
    param([string]$Root, [string]$RepoUrl)

    $repoRoot = Join-Path $Root "Consolidation"
    New-Item -ItemType Directory -Force -Path $Root | Out-Null

    if (Test-Path (Join-Path $repoRoot ".git")) {
        git -C $repoRoot pull --ff-only | Out-Host
    } else {
        git clone $RepoUrl $repoRoot | Out-Host
    }

    return $repoRoot
}

function Ensure-MobileFirewallRule {
    param([int]$Port)

    $ruleName = "Mobile Consolidation API $Port"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-NetFirewallRule `
            -DisplayName $ruleName `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $Port `
            -Profile Private | Out-Null
    }

    return $true
}

function Test-MobileApiPreflight {
    param(
        [int]$Port,
        [string]$RemoteApiUrl,
        [bool]$FirewallOpen
    )

    $ruleName = "Mobile Consolidation API $Port"
    $repairCommand = "New-NetFirewallRule -DisplayName '$ruleName' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private"
    $rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    $healthUrl = "$RemoteApiUrl/health"
    $httpStatus = 0
    $localHealthOk = $false
    $failureStage = ""
    $repairHint = ""

    if (-not $FirewallOpen -or -not $rule) {
        $failureStage = "firewall_rule"
        $repairHint = "Open inbound TCP $Port on the Private profile, then rerun Pairing Doctor from the phone."
    }

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
        $httpStatus = [int]$response.StatusCode
        $localHealthOk = $httpStatus -ge 200 -and $httpStatus -lt 300
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $httpStatus = [int]$_.Exception.Response.StatusCode
        }
        $localHealthOk = $false
    }

    if (-not $localHealthOk -and -not $failureStage) {
        $failureStage = "local_health"
        $repairHint = "Start the Consolidation remote API on 0.0.0.0:$Port, then rerun Pairing Doctor from the phone."
    }

    if ($localHealthOk -and -not $failureStage) {
        $failureStage = "phone_reachability"
        $repairHint = "Import the pairing package on Android and run Pairing Doctor to prove phone reachability."
    }

    return [ordered]@{
        checkedAt = (Get-Date).ToUniversalTime().ToString("o")
        remoteApiUrl = $RemoteApiUrl
        apiPort = $Port
        firewallRuleName = $ruleName
        firewallRulePresent = [bool]$rule
        localHealthOk = $localHealthOk
        phoneReachabilityOk = $false
        httpStatus = $httpStatus
        failureStage = $failureStage
        repairHint = $repairHint
        repairCommand = $repairCommand
    }
}

function Write-RemoteEnvironment {
    param(
        [string]$RepoRoot,
        [int]$Port,
        [string]$ApiKey
    )

    $envPath = Join-Path $RepoRoot ".env.mobile-consolidation"
    $lines = @(
        "MOBILE_CONSOLIDATION_API_KEY=$ApiKey",
        "CONSOLIDATION_API_HOST=0.0.0.0",
        "CONSOLIDATION_API_PORT=$Port",
        "CONSOLIDATION_MOBILE_PAIRING_ENABLED=true"
    )
    Set-Content -LiteralPath $envPath -Value $lines -Encoding UTF8
    return $envPath
}

function Write-PairingPackage {
    param(
        [string]$Root,
        [string]$RemoteApiUrl,
        [string]$ApiKey
    )

    $pairingPath = Join-Path $Root "mobile-pairing.json"
    $deepLinkPath = Join-Path $Root "mobile-pairing-link.txt"
    $payload = [ordered]@{
        version = 1
        app = "mobile-consolidation"
        createdAt = (Get-Date).ToUniversalTime().ToString("o")
        remoteApiUrl = $RemoteApiUrl
        apiKey = $ApiKey
        transportHint = "tailscale"
    }
    $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $pairingPath -Encoding UTF8
    New-PairingDeepLink -Payload $payload | Set-Content -LiteralPath $deepLinkPath -Encoding UTF8
    return [pscustomobject]@{
        jsonPath = $pairingPath
        deepLinkPath = $deepLinkPath
    }
}

function Write-SetupEvidence {
    param(
        [string]$Path,
        [bool]$RepoReady,
        [bool]$TailscaleInstalled,
        [hashtable]$TailscaleStatus,
        [bool]$FirewallOpen,
        [object]$ApiPreflight,
        [string]$PairingPackagePath
    )

    $evidence = [ordered]@{
        installerRanAt = (Get-Date).ToUniversalTime().ToString("o")
        consolidationRepoReady = $RepoReady
        tailscaleInstalled = $TailscaleInstalled
        tailscaleLoggedIn = [bool]$TailscaleStatus.loggedIn
        tailscaleIp = [string]$TailscaleStatus.ip
        tailscaleMagicDnsName = [string]$TailscaleStatus.dnsName
        remoteApiBound = $true
        windowsFirewallOpen = $FirewallOpen
        apiReachableFromPhone = $false
        apiPreflight = $ApiPreflight
        pairingPackageCreatedAt = (Get-Item -LiteralPath $PairingPackagePath).LastWriteTimeUtc.ToString("o")
        pairingPackageImportedAt = ""
        unattendedSmokeTestPassedAt = ""
    }

    $evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
    return $Path
}

if (-not $MobileApiKey) {
    $MobileApiKey = New-MobileApiKey
}

$repoRoot = Ensure-ConsolidationRepo -Root $InstallRoot -RepoUrl $ConsolidationRepoUrl
$tailscaleInstalled = Install-TailscaleIfNeeded
$tailscaleStatus = Connect-TailscaleIfConfigured
$firewallOpen = Ensure-MobileFirewallRule -Port $ApiPort
$envPath = Write-RemoteEnvironment -RepoRoot $repoRoot -Port $ApiPort -ApiKey $MobileApiKey

if (-not $tailscaleStatus.ip) {
    throw "Tailscale did not report a phone-reachable IP. Log in to Tailscale, confirm this PC appears in your tailnet, then rerun setup."
}

$remoteHost = $tailscaleStatus.ip
$remoteApiUrl = "http://$remoteHost`:$ApiPort/api"
$apiPreflight = Test-MobileApiPreflight -Port $ApiPort -RemoteApiUrl $remoteApiUrl -FirewallOpen $firewallOpen
$pairingPackage = Write-PairingPackage -Root $InstallRoot -RemoteApiUrl $remoteApiUrl -ApiKey $MobileApiKey

if (-not $EvidencePath) {
    $EvidencePath = Join-Path $InstallRoot "mobile-setup-evidence.json"
}
$setupEvidencePath = Write-SetupEvidence `
    -Path $EvidencePath `
    -RepoReady (Test-Path (Join-Path $repoRoot ".git")) `
    -TailscaleInstalled $tailscaleInstalled `
    -TailscaleStatus $tailscaleStatus `
    -FirewallOpen $firewallOpen `
    -ApiPreflight $apiPreflight `
    -PairingPackagePath $pairingPackage.jsonPath

Write-Host "Consolidation repo: $repoRoot"
Write-Host "Mobile env file: $envPath"
Write-Host "Pairing package JSON: $($pairingPackage.jsonPath)"
Write-Host "Pairing deep link file: $($pairingPackage.deepLinkPath)"
Write-Host "Setup evidence: $setupEvidencePath"
