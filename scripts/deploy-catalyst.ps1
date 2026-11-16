<#
  Deploy ENGIE360 to Zoho Catalyst AppSail (custom runtime, Docker image).

    powershell -File scripts/deploy-catalyst.ps1              # build the image and deploy it
    powershell -File scripts/deploy-catalyst.ps1 -SkipBuild   # deploy the last built image again
    (or: npm run deploy:catalyst)

  One-time setup first (see DEPLOY.md):
    npm i -g zcatalyst-cli
    catalyst login            # opens a browser; choose your Zoho account (India DC: zoho.in)
    catalyst init             # in this folder: create or link a Catalyst project for ENGIE360

  The server listens on X_ZOHO_CATALYST_LISTEN_PORT (set by AppSail), falling back to 3000, and opens
  the port before loading anything else (AppSail stops apps that don't listen within 10 s).
#>
param(
  [string]$Name = 'engie360',
  [string]$Image = 'engie360-demo:latest',
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail($msg) { Write-Host "`n$msg`n" -ForegroundColor Red; exit 1 }

if (-not (Get-Command catalyst -ErrorAction SilentlyContinue)) {
  Fail "The Catalyst CLI isn't installed. Run: npm i -g zcatalyst-cli, then catalyst login and catalyst init."
}
if (-not (Test-Path (Join-Path $root '.catalystrc')) -and -not (Test-Path (Join-Path $root 'catalyst.json'))) {
  Fail "This folder isn't linked to a Catalyst project yet. Run: catalyst login, then catalyst init (create a project for ENGIE360)."
}
docker version --format '{{.Server.Version}}' *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker isn't running. Start Docker Desktop and try again." }

$out = Join-Path $root '.catalyst-build'
New-Item -ItemType Directory -Force $out | Out-Null
$tar = Join-Path $out 'engie360-demo.tar'

if (-not $SkipBuild) {
  Write-Host "Building $Image for linux/amd64 (the platform AppSail runs)..." -ForegroundColor Cyan
  docker build --platform linux/amd64 -t $Image .
  if ($LASTEXITCODE -ne 0) { Fail 'docker build failed.' }
}

Write-Host "Saving the image to $tar ..." -ForegroundColor Cyan
if (Test-Path $tar) { Remove-Item $tar -Force }
docker save $Image -o $tar
if ($LASTEXITCODE -ne 0) { Fail 'docker save failed.' }
$size = [math]::Round((Get-Item $tar).Length / 1MB)
Write-Host "Image archive: $size MB"

Write-Host "Deploying AppSail service '$Name' ..." -ForegroundColor Cyan
catalyst deploy appsail --name $Name --source "docker-archive://.catalyst-build/engie360-demo.tar" --port 3000
if ($LASTEXITCODE -ne 0) { Fail 'catalyst deploy failed (see the output above).' }

Write-Host @"

Deployed to the development environment.
Next, in the Catalyst console (AppSail > $Name):
  1. Configuration: memory 512 MB is enough. Optional environment variables:
       PUBLIC_URL        the service URL, so the phone QR points at it
       VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY   fixed push keys (otherwise a new pair per restart,
                                              and phones must re-enable notifications)
  2. Open <url>/start and check the portal (/), the staff app (/staff) and push on a phone.
  3. When it looks right: Deploy to production.
"@ -ForegroundColor Green
