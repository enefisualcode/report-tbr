param(
  [string]$Message = "Update TBR Performance UI"
)

$ErrorActionPreference = "Stop"
$gitDir = "pushmeta/.git"

if (-not (Test-Path $gitDir)) {
  throw "Repository Git tidak ditemukan di pushmeta/.git"
}

git --git-dir=$gitDir --work-tree=. add dist package.json server.js deploy.ps1 .github

$pending = git --git-dir=$gitDir --work-tree=. diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "Tidak ada perubahan baru untuk di-commit."
  exit 0
}

git --git-dir=$gitDir --work-tree=. commit -m $Message
git --git-dir=$gitDir --work-tree=. push origin main
if ($LASTEXITCODE -ne 0) {
  throw "Commit berhasil, tetapi push gagal. Periksa koneksi dan autentikasi GitHub."
}
Write-Host "Commit dan push berhasil."
