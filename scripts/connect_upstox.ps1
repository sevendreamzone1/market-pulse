# Run locally in PowerShell. Never run this in GitHub Actions or with transcription enabled.
$ErrorActionPreference = 'Stop'
$secureToken = $null
$plainToken = $null
$tokenPointer = [IntPtr]::Zero
try {
    $secureToken = Read-Host 'Enter your current Upstox access token (hidden)' -AsSecureString
    $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer).Trim()
    if ([string]::IsNullOrWhiteSpace($plainToken)) { throw 'Empty token' }
    $response = Invoke-RestMethod -Method Get -Uri 'https://api.upstox.com/v3/feed/market-data-feed/authorize' -Headers @{ Authorization = "Bearer $plainToken"; Accept = 'application/json' } -TimeoutSec 20 -MaximumRedirection 0
    $socketAddress = [Uri]$response.data.authorized_redirect_uri
    if ($socketAddress.Scheme -ne 'wss' -or -not $socketAddress.Host.EndsWith('.upstox.com') -or $socketAddress.UserInfo -or $socketAddress.Fragment) { throw 'Invalid socket URL' }
    Set-Clipboard -Value $socketAddress.AbsoluteUri
    Write-Host 'One-time URL copied. Open the live page, select One-time authorized WebSocket URL, paste, and connect immediately.'
    Write-Host 'The clipboard contains a private credential. Clear it after connecting with: Set-Clipboard -Value ""'
} catch {
    # Do not print provider responses, request objects, or exceptions containing credentials.
    Write-Host 'Could not authorize or copy the URL. Check your network, current token, feed permissions, and clipboard availability.'
    exit 1
} finally {
    $plainToken = $null
    $response = $null
    $socketAddress = $null
    if ($tokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
    if ($secureToken) { $secureToken.Dispose() }
}
