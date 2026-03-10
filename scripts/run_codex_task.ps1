#requires -Version 7.0

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Task,

    [string]$TaskLabel,

    [Parameter(Mandatory = $true)]
    [string]$Model,

    [string]$ReasoningEffort = "high",

    [string]$OutputPath = "output.txt",

    [string]$WorkingDirectory = ".",

    [string]$MetricsCsvPath = "benchmark_runs.csv",

    [switch]$SkipMetrics
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Format-Duration {
    param(
        [Parameter(Mandatory = $true)]
        [TimeSpan]$Duration
    )

    return "{0:00}:{1:00}:{2:00}.{3:000}" -f $Duration.Hours, $Duration.Minutes, $Duration.Seconds, $Duration.Milliseconds
}

function Get-JsonEventsFromContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $events = New-Object System.Collections.Generic.List[object]

    foreach ($line in ($Content -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        try {
            $events.Add(($line | ConvertFrom-Json -Depth 100))
        }
        catch {
            continue
        }
    }

    return $events
}

function Get-RepoRelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    $resolvedPath = [System.IO.Path]::GetFullPath($Path)
    $resolvedRepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)

    if ($resolvedPath.StartsWith($resolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relativePath = [System.IO.Path]::GetRelativePath($resolvedRepoRoot, $resolvedPath)
        $normalizedPath = $relativePath -replace "\\", "/"
        return "./$normalizedPath"
    }

    return $resolvedPath
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedWorkingDirectory = if ([System.IO.Path]::IsPathRooted($WorkingDirectory)) {
    $WorkingDirectory
} else {
    Join-Path $repoRoot $WorkingDirectory
}
$resolvedWorkingDirectory = [System.IO.Path]::GetFullPath($resolvedWorkingDirectory)
$resolvedOutputPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
} else {
    Join-Path $resolvedWorkingDirectory $OutputPath
}
$resolvedMetricsCsvPath = if ($SkipMetrics) {
    $null
} elseif ([System.IO.Path]::IsPathRooted($MetricsCsvPath)) {
    $MetricsCsvPath
} else {
    Join-Path $repoRoot $MetricsCsvPath
}
$csvWorkingDirectory = Get-RepoRelativePath -Path $resolvedWorkingDirectory -RepoRoot $repoRoot
$csvOutputPath = Get-RepoRelativePath -Path $resolvedOutputPath -RepoRoot $repoRoot
$csvModel = "codex/$Model"

$outputDirectory = Split-Path -Parent $resolvedOutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

if ($resolvedMetricsCsvPath) {
    $metricsDirectory = Split-Path -Parent $resolvedMetricsCsvPath
    if ($metricsDirectory) {
        New-Item -ItemType Directory -Path $metricsDirectory -Force | Out-Null
    }
}

$startTime = Get-Date
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$runId = [guid]::NewGuid().Guid
$codexScriptPath = (Get-Command codex -ErrorAction Stop).Source

$codexArgs = @(
    "exec",
    "--full-auto",
    "--json",
    "-m", $Model,
    "-c", "model_reasoning_effort=`"$ReasoningEffort`"",
    $Task
)
$commandLine = "codex " + (($codexArgs | ForEach-Object {
    if ($_ -match '\s') { '"' + $_.Replace('"', '\"') + '"' } else { $_ }
}) -join " ")

$headerLines = @(
    "Codex task run",
    "Run ID: $runId",
    "Started: $($startTime.ToString('yyyy-MM-dd HH:mm:ssK'))",
    "Working directory: $resolvedWorkingDirectory",
    "Output file: $resolvedOutputPath",
    "Metrics CSV: $(if ($resolvedMetricsCsvPath) { $resolvedMetricsCsvPath } else { '<disabled>' })",
    "Model: $Model",
    "CSV model label: $csvModel",
    "Reasoning effort: $ReasoningEffort",
    "Task label: $(if ($TaskLabel) { $TaskLabel } else { '<none>' })",
    "Task: $Task",
    "Command: $commandLine",
    ("-" * 80)
)

Set-Content -Path $resolvedOutputPath -Value $headerLines -Encoding utf8

$exitCode = $null
$stdoutPath = $null
$stderrPath = $null
$metricsSummary = $null
$previousLocation = Get-Location

try {
    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()

    Set-Location $resolvedWorkingDirectory
    & $codexScriptPath @codexArgs 1> $stdoutPath 2> $stderrPath
    $exitCode = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { 0 }

    $stdoutContent = if (Test-Path $stdoutPath) { Get-Content -Path $stdoutPath -Raw } else { "" }
    $stderrContent = if (Test-Path $stderrPath) { Get-Content -Path $stderrPath -Raw } else { "" }

    if ($stdoutContent) {
        Add-Content -Path $resolvedOutputPath -Value $stdoutContent -Encoding utf8
        Write-Host $stdoutContent
    }

    if ($stderrContent) {
        if ($stdoutContent) {
            Add-Content -Path $resolvedOutputPath -Value "" -Encoding utf8
        }
        Add-Content -Path $resolvedOutputPath -Value "[stderr]" -Encoding utf8
        Add-Content -Path $resolvedOutputPath -Value $stderrContent -Encoding utf8
        Write-Host "[stderr]"
        Write-Host $stderrContent
    }

    if (-not $SkipMetrics -and $stdoutContent) {
        $events = Get-JsonEventsFromContent -Content $stdoutContent
        $threadId = ($events | Where-Object { $_.thread_id } | Select-Object -First 1 -ExpandProperty thread_id)
        $turnCompletedEvents = $events | Where-Object { $_.type -eq "turn.completed" -and $_.usage }

        if ($threadId -or $turnCompletedEvents.Count -gt 0) {
            $metricsSummary = [ordered]@{
                started_date = $startTime.ToString("yyyy-MM-dd")
                finished_date = $null
                duration_ms = $null
                duration_hms = $null
                working_directory = $csvWorkingDirectory
                output_path = $csvOutputPath
                model = $csvModel
                variant = $ReasoningEffort
                task = if ($TaskLabel) { $TaskLabel } else { $Task }
                task_name = if ($TaskLabel) { $TaskLabel } else { $Task }
                task_prompt = $Task
                exit_code = $exitCode
                cost_usd = ""
                tokens_total = 0
                tokens_input = 0
                tokens_output = 0
                tokens_reasoning = 0
                tokens_cache_read = 0
                tokens_cache_write = 0
                step_finish_count = 0
            }

            foreach ($event in $turnCompletedEvents) {
                $metricsSummary.step_finish_count += 1

                if ($null -ne $event.usage.input_tokens) {
                    $metricsSummary.tokens_input += [int64]$event.usage.input_tokens
                }
                if ($null -ne $event.usage.output_tokens) {
                    $metricsSummary.tokens_output += [int64]$event.usage.output_tokens
                }
                if ($null -ne $event.usage.cached_input_tokens) {
                    $metricsSummary.tokens_cache_read += [int64]$event.usage.cached_input_tokens
                }
            }

            $metricsSummary.tokens_total = $metricsSummary.tokens_input + $metricsSummary.tokens_output
        }
    }
}
finally {
    Set-Location $previousLocation
    $stopwatch.Stop()

    $endTime = Get-Date
    if ($metricsSummary) {
        $metricsSummary.finished_date = $endTime.ToString("yyyy-MM-dd")
        $metricsSummary.duration_ms = [int64][math]::Round($stopwatch.Elapsed.TotalMilliseconds)
        $metricsSummary.duration_hms = Format-Duration -Duration $stopwatch.Elapsed

        $metricsObject = [pscustomobject]$metricsSummary
        if (Test-Path $resolvedMetricsCsvPath) {
            $metricsObject | Export-Csv -Path $resolvedMetricsCsvPath -Append -NoTypeInformation -Encoding utf8
        }
        else {
            $metricsObject | Export-Csv -Path $resolvedMetricsCsvPath -NoTypeInformation -Encoding utf8
        }
    }

    $footerLines = @(
        "",
        ("-" * 80),
        "Finished: $($endTime.ToString('yyyy-MM-dd HH:mm:ssK'))",
        "Duration: $(Format-Duration -Duration $stopwatch.Elapsed)",
        "Exit code: $(if ($exitCode -ne $null) { $exitCode } else { '<unknown>' })"
    )

    if ($metricsSummary) {
        $footerLines += @(
            "Session ID: $(if ($metricsSummary.session_id) { $metricsSummary.session_id } else { '<unknown>' })",
            "Tokens total: $($metricsSummary.tokens_total)",
            "Tokens input: $($metricsSummary.tokens_input)",
            "Tokens output: $($metricsSummary.tokens_output)",
            "Tokens reasoning: $($metricsSummary.tokens_reasoning)",
            "Tokens cache read: $($metricsSummary.tokens_cache_read)",
            "Tokens cache write: $($metricsSummary.tokens_cache_write)",
            "Turn completions: $($metricsSummary.step_finish_count)"
        )
    }

    Add-Content -Path $resolvedOutputPath -Value $footerLines -Encoding utf8

    if ($stdoutPath -and (Test-Path $stdoutPath)) {
        Remove-Item -Path $stdoutPath -Force
    }

    if ($stderrPath -and (Test-Path $stderrPath)) {
        Remove-Item -Path $stderrPath -Force
    }
}

if ($exitCode -ne $null) {
    exit $exitCode
}
