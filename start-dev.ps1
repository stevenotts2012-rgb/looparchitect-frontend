# Start Development Server
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Starting LoopArchitect Frontend" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Preparing stable dev startup..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Kill stale listeners on common Next.js dev ports
$ports = 3000..3005
$pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
	Where-Object { $_.LocalPort -in $ports } |
	Select-Object -ExpandProperty OwningProcess -Unique

if ($pids) {
	Write-Host "Stopping stale processes on ports 3000-3005..." -ForegroundColor Yellow
	foreach ($processId in $pids) {
		Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
	}
	Start-Sleep -Seconds 1
}

$env:PORT = "3001"
Write-Host "Development server will start at:" -ForegroundColor Yellow
Write-Host "  http://localhost:$env:PORT" -ForegroundColor Green
Write-Host ""

# Start the dev server on a fixed port
npx next dev -p $env:PORT
