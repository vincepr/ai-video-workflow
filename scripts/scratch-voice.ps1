param(
  [Parameter(Mandatory=$true)][string]$TextFile,
  [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speaker.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet,
    [System.Speech.Synthesis.VoiceAge]::NotSet, 0,
    [System.Globalization.CultureInfo]::GetCultureInfo('en-US'))
  $speaker.SetOutputToWaveFile($OutputPath)
  $speaker.Speak([System.IO.File]::ReadAllText($TextFile))
} finally {
  $speaker.Dispose()
}
