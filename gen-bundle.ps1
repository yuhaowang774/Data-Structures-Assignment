$graph = [System.IO.File]::ReadAllText("$PSScriptRoot\data\graph.json", [System.Text.Encoding]::UTF8)
$stations = [System.IO.File]::ReadAllText("$PSScriptRoot\data\stations.json", [System.Text.Encoding]::UTF8)
$routes = [System.IO.File]::ReadAllText("$PSScriptRoot\data\routes.json", [System.Text.Encoding]::UTF8)

$graph = $graph -replace '\r?\n',''
$stations = $stations -replace '\r?\n',''
$routes = $routes -replace '\r?\n',''

$js = "var GRAPH_DATA = $graph;`n`nvar STATIONS_DATA = $stations;`n`nvar ROUTES_DATA = $routes;`n"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText("$PSScriptRoot\data-bundle.js", $js, $utf8NoBom)
Write-Host "Generated data-bundle.js ($((Get-Item "$PSScriptRoot\data-bundle.js").Length) bytes)"
