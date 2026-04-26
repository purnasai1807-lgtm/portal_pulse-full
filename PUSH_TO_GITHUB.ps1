# PortalPulse Push Script for purnasai1807-lgtm
# Run this in PowerShell after logging into GitHub

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PortalPulse Deployment Setup" -ForegroundColor Cyan
Write-Host "  GitHub: purnasai1807-lgtm" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: Check if gh is logged in
Write-Host "`n[1/4] Checking GitHub login..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($authStatus -match "not logged into any GitHub hosts") {
    Write-Host "You need to log in to GitHub first." -ForegroundColor Red
    Write-Host "Run: gh auth login" -ForegroundColor Green
    Write-Host "Then run this script again." -ForegroundColor Green
    exit 1
}

# Step 2: Create repo and push
Write-Host "`n[2/4] Creating GitHub repo 'portal_pulse-full'..." -ForegroundColor Yellow
gh repo create portal_pulse-full --public --source=. --remote=origin --push

# Step 3: Verify
Write-Host "`n[3/4] Verifying push..." -ForegroundColor Yellow
$remoteUrl = git remote get-url origin 2>$null
if ($remoteUrl -match "purnasai1807-lgtm/portal_pulse-full") {
    Write-Host "SUCCESS! Repo pushed to:" -ForegroundColor Green
    Write-Host "https://github.com/purnasai1807-lgtm/portal_pulse-full" -ForegroundColor Cyan
} else {
    Write-Host "Something went wrong. Check output above." -ForegroundColor Red
    exit 1
}

# Step 4: Deploy to Render
Write-Host "`n[4/4] Ready for Render deployment!" -ForegroundColor Green
Write-Host "Click this link to deploy:" -ForegroundColor Yellow
Write-Host "https://render.com/deploy?repo=https://github.com/purnasai1807-lgtm/portal_pulse-full" -ForegroundColor Cyan

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS:" -ForegroundColor Cyan
Write-Host "  1. Open the Render deploy link above" -ForegroundColor White
Write-Host "  2. Connect your GitHub account" -ForegroundColor White
Write-Host "  3. Render will auto-create everything" -ForegroundColor White
Write-Host "  4. Your public URL will appear in ~5 min" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
