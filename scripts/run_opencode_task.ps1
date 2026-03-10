#requires -Version 7.0

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Task,

    [string]$TaskLabel,

    [Parameter(Mandatory = $true)]
    [string]$Model,

    [string]$Variant,

    [string]$OutputPath = "output.txt",

    [string]$WorkingDirectory = ".",

    [string]$Title,

    [string]$Agent,

    [string[]]$Files,

    [switch]$ContinueLastSession,

    [string]$Session,

    [switch]$Fork,

    [switch]$Share,

    [switch]$Thinking,

    [switch]$PrintLogs,

    [ValidateSet("default", "json")]
    [string]$Format = "json",

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

$effectiveFormat = if (-not $SkipMetrics -and $Format -ne "json") { "json" } else { $Format }

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

$opencodeArgs = @("run", "--model", $Model, "--format", $effectiveFormat)

if ($Variant) {
    $opencodeArgs += @("--variant", $Variant)
}

if ($Title) {
    $opencodeArgs += @("--title", $Title)
}

if ($Agent) {
    $opencodeArgs += @("--agent", $Agent)
}

if ($ContinueLastSession) {
    $opencodeArgs += "--continue"
}

if ($Session) {
    $opencodeArgs += @("--session", $Session)
}

if ($Fork) {
    $opencodeArgs += "--fork"
}

if ($Share) {
    $opencodeArgs += "--share"
}

if ($Thinking) {
    $opencodeArgs += "--thinking"
}

if ($PrintLogs) {
    $opencodeArgs += "--print-logs"
}

foreach ($file in ($Files | Where-Object { $_ })) {
    $opencodeArgs += @("--file", $file)
}

$opencodeArgs += "--"
$opencodeArgs += $Task

$commandLine = "opencode " + (($opencodeArgs | ForEach-Object {
    if ($_ -match '\s') { '"' + $_.Replace('"', '\"') + '"' } else { $_ }
}) -join " ")

$headerLines = @(
    "OpenCode task run",
    "Run ID: $runId",
    "Started: $($startTime.ToString('yyyy-MM-dd HH:mm:ssK'))",
    "Working directory: $resolvedWorkingDirectory",
    "Output file: $resolvedOutputPath",
    "Metrics CSV: $(if ($resolvedMetricsCsvPath) { $resolvedMetricsCsvPath } else { '<disabled>' })",
    "Model: $Model",
    "Variant: $(if ($Variant) { $Variant } else { '<default>' })",
    "Format: $effectiveFormat",
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

try {
    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()

    $process = Start-Process `
        -FilePath "opencode" `
        -ArgumentList $opencodeArgs `
        -WorkingDirectory $resolvedWorkingDirectory `
        -NoNewWindow `
        -Wait `
        -PassThru `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath

    $exitCode = $process.ExitCode

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

    if (-not $SkipMetrics -and $effectiveFormat -eq "json" -and $stdoutContent) {
        $events = Get-JsonEventsFromContent -Content $stdoutContent
        $sessionId = ($events | Where-Object { $_.sessionID } | Select-Object -First 1 -ExpandProperty sessionID)
        $stepFinishEvents = $events | Where-Object { $_.type -eq "step_finish" -and $_.part }

        $metricsSummary = [ordered]@{
            run_id = $runId
            session_id = $sessionId
            started_at = $startTime.ToString("o")
            finished_at = $null
            duration_ms = $null
            duration_hms = $null
            working_directory = $resolvedWorkingDirectory
            output_path = $resolvedOutputPath
            model = $Model
            variant = if ($Variant) { $Variant } else { "" }
            task = if ($TaskLabel) { $TaskLabel } else { $Task }
            task_name = if ($TaskLabel) { $TaskLabel } else { $Task }
            task_prompt = $Task
            exit_code = $exitCode
            cost_usd = 0.0
            tokens_total = 0
            tokens_input = 0
            tokens_output = 0
            tokens_reasoning = 0
            tokens_cache_read = 0
            tokens_cache_write = 0
            step_finish_count = 0
        }

        foreach ($event in $stepFinishEvents) {
            $metricsSummary.step_finish_count += 1

            if ($null -ne $event.part.cost) {
                $metricsSummary.cost_usd += [double]$event.part.cost
            }

            if ($event.part.tokens) {
                if ($null -ne $event.part.tokens.total) {
                    $metricsSummary.tokens_total += [int64]$event.part.tokens.total
                }
                if ($null -ne $event.part.tokens.input) {
                    $metricsSummary.tokens_input += [int64]$event.part.tokens.input
                }
                if ($null -ne $event.part.tokens.output) {
                    $metricsSummary.tokens_output += [int64]$event.part.tokens.output
                }
                if ($null -ne $event.part.tokens.reasoning) {
                    $metricsSummary.tokens_reasoning += [int64]$event.part.tokens.reasoning
                }
                if ($event.part.tokens.cache) {
                    if ($null -ne $event.part.tokens.cache.read) {
                        $metricsSummary.tokens_cache_read += [int64]$event.part.tokens.cache.read
                    }
                    if ($null -ne $event.part.tokens.cache.write) {
                        $metricsSummary.tokens_cache_write += [int64]$event.part.tokens.cache.write
                    }
                }
            }
        }
    }
}
finally {
    $stopwatch.Stop()

    $endTime = Get-Date
    if ($metricsSummary) {
        $metricsSummary.finished_at = $endTime.ToString("o")
        $metricsSummary.duration_ms = [int64][math]::Round($stopwatch.Elapsed.TotalMilliseconds)
        $metricsSummary.duration_hms = Format-Duration -Duration $stopwatch.Elapsed
        $metricsSummary.cost_usd = [string]::Format([System.Globalization.CultureInfo]::InvariantCulture, "{0:F8}", [double]$metricsSummary.cost_usd)

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
            "Cost (USD): $($metricsSummary.cost_usd)",
            "Tokens total: $($metricsSummary.tokens_total)",
            "Tokens input: $($metricsSummary.tokens_input)",
            "Tokens output: $($metricsSummary.tokens_output)",
            "Tokens reasoning: $($metricsSummary.tokens_reasoning)",
            "Tokens cache read: $($metricsSummary.tokens_cache_read)",
            "Tokens cache write: $($metricsSummary.tokens_cache_write)",
            "Step finishes: $($metricsSummary.step_finish_count)"
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
