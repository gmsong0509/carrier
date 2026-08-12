param(
  [int]$Port = 4173,
  [string]$Root = (Join-Path $PSScriptRoot "..\dist")
)

$resolvedRoot = [System.IO.Path]::GetFullPath($Root)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      while (-not [string]::IsNullOrEmpty($reader.ReadLine())) {
        # 정적 파일 검사에는 요청 헤더 값이 필요하지 않습니다.
      }

      $requestTarget = ($requestLine -split " ")[1]
      $relativePath = ([System.Uri]::UnescapeDataString(($requestTarget -split "\?")[0])).TrimStart("/")
      if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = "index.html" }

      $candidatePath = [System.IO.Path]::GetFullPath((Join-Path $resolvedRoot $relativePath))
      $isSafeFile = $candidatePath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $candidatePath -PathType Leaf)

      if ($isSafeFile) {
        $statusLine = "HTTP/1.1 200 OK"
        $body = [System.IO.File]::ReadAllBytes($candidatePath)
        $extension = [System.IO.Path]::GetExtension($candidatePath).ToLowerInvariant()
        $contentType = $contentTypes[$extension]
        if ([string]::IsNullOrWhiteSpace($contentType)) { $contentType = "application/octet-stream" }
      } else {
        $statusLine = "HTTP/1.1 404 Not Found"
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        $contentType = "text/plain; charset=utf-8"
      }

      $headers = "$statusLine`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
