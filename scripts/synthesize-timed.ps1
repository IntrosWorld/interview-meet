param([switch]$Server)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
function Invoke-TimedSpeech($requestData) {
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($requestData.action -eq 'voices') {
    $voices = @($synth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { @{ name = $_.VoiceInfo.Name; culture = $_.VoiceInfo.Culture.Name } })
    @{ voices = $voices } | ConvertTo-Json -Compress -Depth 5
    $synth.Dispose()
    return
}
$memory = New-Object System.IO.MemoryStream
try {
    if ($requestData.voice) { $synth.SelectVoice([string]$requestData.voice) }
    $synth.Rate = 1
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth.SetOutputToAudioStream($memory, $format)
    Register-ObjectEvent -InputObject $synth -EventName VisemeReached -SourceIdentifier 'timed-visemes' | Out-Null
    $synth.Speak([string]$requestData.text)
    $synth.SetOutputToNull()
    $visemes = @(Get-Event -SourceIdentifier 'timed-visemes' -ErrorAction SilentlyContinue | ForEach-Object {
        @{ id = [int]$_.SourceEventArgs.Viseme; time = $_.SourceEventArgs.AudioPosition.TotalSeconds; duration = $_.SourceEventArgs.Duration.TotalSeconds }
    })
    $pcm = $memory.ToArray()
    $wave = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter($wave)
    $writer.Write([Text.Encoding]::ASCII.GetBytes('RIFF')); $writer.Write([int](36 + $pcm.Length))
    $writer.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt ')); $writer.Write([int]16)
    $writer.Write([int16]1); $writer.Write([int16]1); $writer.Write([int]16000); $writer.Write([int]32000)
    $writer.Write([int16]2); $writer.Write([int16]16); $writer.Write([Text.Encoding]::ASCII.GetBytes('data'))
    $writer.Write([int]$pcm.Length); $writer.Write($pcm); $writer.Flush()
    @{ audio = [Convert]::ToBase64String($wave.ToArray()); visemes = $visemes; voice = $synth.Voice.Name } | ConvertTo-Json -Compress -Depth 5
    $writer.Dispose(); $wave.Dispose()
} finally {
    Unregister-Event -SourceIdentifier 'timed-visemes' -ErrorAction SilentlyContinue
    Remove-Event -SourceIdentifier 'timed-visemes' -ErrorAction SilentlyContinue
    $memory.Dispose(); $synth.Dispose()
}
}
if ($Server) {
    while ($null -ne ($requestLine = [Console]::In.ReadLine())) {
        try { Invoke-TimedSpeech ($requestLine | ConvertFrom-Json) }
        catch { @{ error = 'Local speech synthesis failed' } | ConvertTo-Json -Compress }
    }
} else { Invoke-TimedSpeech ([Console]::In.ReadToEnd() | ConvertFrom-Json) }

