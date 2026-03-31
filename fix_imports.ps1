# Run this from the root of your athleteos-tournament project
# Open PowerShell, cd to your project folder, then: .\fix_imports.ps1

Write-Host "Fixing import paths..."

# Helper function
function Fix-File($path, $find, $replace) {
    $content = Get-Content $path -Raw -Encoding UTF8
    $content = $content.Replace($find, $replace)
    Set-Content $path $content -Encoding UTF8 -NoNewline
    Write-Host "  Fixed: $path"
}

# QRManager - wrong depth (in pages/director, needs ../../lib)
Fix-File "src\pages\director\QRManager.jsx" "from '../lib/supabase'" "from '../../lib/supabase'"
Fix-File "src\pages\director\QRManager.jsx" "from '../components/" "from '../../components/"

# AuthContext - imports itself wrongly (already IN lib/, use ./supabase)
Fix-File "src\lib\AuthContext.jsx" "from '../lib/supabase'" "from './supabase'"

# scorekeeperAuth - same issue
Fix-File "src\lib\scorekeeperAuth.jsx" "from '../lib/supabase'" "from './supabase'"

# DirectorHQ - remove dynamic imports (supabase already imported statically at top)
$dhq = Get-Content "src\pages\director\DirectorHQ.jsx" -Raw -Encoding UTF8
$dhq = $dhq -replace ".*const \{ supabase \} = await import\('../../lib/supabase'\).*\n", ""
Set-Content "src\pages\director\DirectorHQ.jsx" $dhq -Encoding UTF8 -NoNewline
Write-Host "  Fixed: src\pages\director\DirectorHQ.jsx"

Write-Host ""
Write-Host "Done! Now run:"
Write-Host "  git add -A"
Write-Host "  git commit -m 'fix import paths'"
Write-Host "  git push"
