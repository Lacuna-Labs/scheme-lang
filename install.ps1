# scheme-lang installer — Windows (PowerShell 5.1+ / PowerShell 7+)
#
# usage (one-liner):
#   iwr -useb https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.ps1 | iex
#
# what it does:
#   1. verifies git + node (v18+) are on PATH
#   2. clones (or updates) the repo into $env:LOCALAPPDATA\scheme-lang\repo
#   3. writes .cmd shims into    $env:LOCALAPPDATA\scheme-lang\bin
#      (scheme-lang.cmd + sakura-scheme.cmd — each shells to `node <path>\bin\<name>`)
#   4. appends that bin dir to your USER PATH — idempotent, no double-add
#
# tested on:
#   Windows 10/11, PowerShell 5.1 (built-in) and PowerShell 7.x.
#
# uninstall:
#   Remove-Item -Recurse -Force $env:LOCALAPPDATA\scheme-lang
#   # then manually remove the bin dir from your User PATH via:
#   #   [Environment]::SetEnvironmentVariable('PATH', <cleaned-path>, 'User')
#   # or open: Settings -> System -> About -> Advanced system settings -> Environment Variables

$ErrorActionPreference = 'Stop'

$RepoUrl     = 'https://github.com/Lacuna-Labs/scheme-lang'
$InstallRoot = Join-Path $env:LOCALAPPDATA 'scheme-lang'
$RepoDir     = Join-Path $InstallRoot 'repo'
$BinDir      = Join-Path $InstallRoot 'bin'

function Say  ($msg) { Write-Host ("  " + $msg) }
function Warn ($msg) { Write-Host ("  ! " + $msg) -ForegroundColor Yellow }
function Fail ($msg) { Write-Host ("  x " + $msg) -ForegroundColor Red; exit 1 }

# ---- prereqs ----------------------------------------------------------------

if (-not (Get-Command git  -ErrorAction SilentlyContinue)) {
  Fail "git is required. Install Git for Windows from https://git-scm.com/download/win and re-run."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "node is required (v18+). Install from https://nodejs.org and re-run."
}

$nodeVersionOutput = (& node --version) 2>$null
if (-not $nodeVersionOutput) {
  Fail "could not run 'node --version' — is your node install healthy?"
}
# e.g. "v20.11.0"
$nodeMajor = [int]($nodeVersionOutput.TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 18) {
  Fail "node $nodeMajor is too old — need v18+ (yours: $nodeVersionOutput)"
}

# ---- clone or update --------------------------------------------------------

if (Test-Path (Join-Path $RepoDir '.git')) {
  Say "updating scheme-lang in $RepoDir..."
  try {
    git -C $RepoDir fetch --quiet origin main 2>$null | Out-Null
    git -C $RepoDir pull --ff-only --quiet 2>$null   | Out-Null
  } catch {
    Warn "could not fast-forward — you may have local changes in $RepoDir"
  }
} else {
  if (Test-Path $RepoDir) {
    Warn "$RepoDir exists but is not a git checkout — removing"
    Remove-Item -Recurse -Force $RepoDir
  }
  Say "cloning scheme-lang into $RepoDir..."
  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
  git clone --quiet --depth 1 $RepoUrl $RepoDir
  if ($LASTEXITCODE -ne 0) {
    Fail "clone failed — check network + that $RepoUrl is reachable"
  }
}

# ---- write shims ------------------------------------------------------------

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null

$schemeTarget = Join-Path $RepoDir 'bin\scheme-lang'
$sakuraTarget = Join-Path $RepoDir 'bin\sakura-scheme'

# .cmd shim — CRLF endings, quoted paths, forwards all args.
# `%~dp0..\repo\bin\<name>` would work too but hard-coding the absolute path
# is simpler and matches the "clones to LOCALAPPDATA" contract.
$schemeShim = @"
@echo off
node "$schemeTarget" %*
"@
$sakuraShim = @"
@echo off
node "$sakuraTarget" %*
"@

Set-Content -Path (Join-Path $BinDir 'scheme-lang.cmd')   -Value $schemeShim -Encoding ASCII
Set-Content -Path (Join-Path $BinDir 'sakura-scheme.cmd') -Value $sakuraShim -Encoding ASCII

# ---- add BinDir to user PATH (idempotent) ----------------------------------

$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($null -eq $userPath) { $userPath = '' }

# split, filter empties, exact-match test (case-insensitive on Windows)
$pathParts = $userPath -split ';' | Where-Object { $_ -ne '' }
$already   = $false
foreach ($p in $pathParts) {
  if ($p.TrimEnd('\') -ieq $BinDir.TrimEnd('\')) { $already = $true; break }
}

$pathHint = ''
if (-not $already) {
  $newUserPath = if ($userPath) { "$userPath;$BinDir" } else { "$BinDir" }
  try {
    [Environment]::SetEnvironmentVariable('PATH', $newUserPath, 'User')
    Say "added $BinDir to your User PATH."
    $pathHint = "open a new terminal (or run: `$env:PATH += ';$BinDir') to pick up the new PATH."
  } catch {
    Warn "could not persist PATH change — add $BinDir to your PATH manually."
    $pathHint = "temporary fix for this session:  `$env:PATH += ';$BinDir'"
  }
} else {
  Say "$BinDir already on your User PATH — leaving it alone."
}

# ---- report -----------------------------------------------------------------

Say ""
Say "installed on Windows."
Say ""
Say "  $BinDir\scheme-lang.cmd    ->  node $schemeTarget"
Say "  $BinDir\sakura-scheme.cmd  ->  node $sakuraTarget"
Say ""
if ($pathHint) { Say $pathHint; Say "" }
Say "try:"
Say "  sakura-scheme                     # REPL"
Say "  sakura-scheme eval `"(+ 1 2)`"      # one-shot"
Say ""
Say "uninstall:"
Say "  Remove-Item -Recurse -Force `$env:LOCALAPPDATA\scheme-lang"
Say "  # then remove $BinDir from your User PATH:"
Say "  #   Settings -> System -> About -> Advanced system settings -> Environment Variables"
