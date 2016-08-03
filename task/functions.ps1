Function Get-MatchingFiles
{
    [CmdletBinding()]
    param(
        [string] $Pattern,
        [string] $Root
    )

    [string[]]$matchingFiles = @()
    $Pattern = $Pattern -replace "\r?\n", ";"
    
    if ($Pattern.Contains("*") -or $Pattern.Contains("?"))
    {
        $matchingFiles += @(Find-Files -SearchPattern $Pattern -Root $Root)
        if (!$matchingFiles.Count)
        {
            throw "Target files not found using search pattern '${Pattern}'."
        }
    }
    else
    {
        $matchingFiles += @($Pattern -split ";")
    }
    
    for ($i = 0 ; $i -lt $matchingFiles.Length ; ++$i) {
        if (!$matchingFiles[$i].StartsWith($Root))
        {
            $matchingFiles[$i] = (Join-Path $Root $matchingFiles[$i])
        }
    }

    $matchingFiles
}

Function Get-FileEncoding
{
    [CmdletBinding()]
    param(
        [string] $Path
    )
    
    $bytes = [byte[]](Get-content -Path $Path -Encoding Byte -ReadCount 4 -TotalCount 4)
    if ($bytes[0] -eq 0x2b -and $bytes[1] -eq 0x2f -and $bytes[2] -eq 0x76 -and ($bytes[3] -eq 0x38 -or $bytes[3] -eq 0x39 -or $bytes[3] -eq 0x2b -or $bytes[3] -eq 0x2f))
    {
        return 'UTF7'
    }
    
    if ($Bytes[0] -eq 0xef -and $Bytes[1] -eq 0xbb -and $Bytes[2] -eq 0xbf)
    {
        return 'UTF8'
    }
    
    if ($bytes[0] -eq 0xfe -and $bytes[1] -eq 0xff)
    {
        return 'BigEndianUnicode'
    }
    
    if ($bytes[0] -eq 0xff -and $bytes[1] -eq 0xfe)
    {
        return 'Unicode'
    }
    
    if ($bytes[0] -eq 0 -and $bytes[1] -eq 0 -and $bytes[2] -eq 0xfe -and $bytes[3] -eq 0xff)
    {
        return 'BigEndianUTF32'
    }

    if ($bytes[0] -eq 0xfe -and $bytes[1] -eq 0xff -and $bytes[2] -eq 0 -and $bytes[3] -eq 0)
    {
        return 'UTF32'
    }

    'Ascii'
}

Function Get-Encoding
{
    [CmdletBinding()]
    param(
        [string] $Name,
        [switch] $WriteBOM
    )
    
    switch ($Name)
    {
        "Ascii" { return New-Object System.Text.ASCIIEncoding }
        "UTF7" { return New-Object System.Text.UTF7Encoding }
        "UTF8" { return New-Object System.Text.UTF8Encoding($WriteBOM) }
        "Unicode" { return New-Object System.Text.UnicodeEncoding($false, $WriteBOM) }
        "BigEndianUnicode" { return New-Object System.Text.UnicodeEncoding($true, $WriteBOM) }
        "UTF32" { return New-Object System.Text.UTF32Encoding($false, $WriteBOM) }
        "BigEndianUTF32" { return New-Object System.Text.UTF32Encoding($true, $WriteBOM) }
    }
}

Function Expand-Variables
{
    [CmdletBinding()]
    param(
        [string] $Text
    )

    $maxIteration = 50
    $iteration = 0
    do
    {
        $oldText = $Text
        $Text = [Microsoft.TeamFoundation.DistributedTask.Agent.Common.ContextExtensions]::ExpandVariables($distributedTaskContext, $Text)
    }
    while (($Text -ne $oldText) -and (++$iteration -lt $maxIteration))

    if ($iteration -eq $maxIteration)
    {
        Write-Warning "Expand variables: exceeded max iterations."
    }

    $Text
}

Function Set-Variables
{
    [CmdletBinding()]
    param(
        [string] $Path,
        [regex] $Regex,
        [string] $EncodingName,
        [string] $ActionOnMissing,
        [switch] $WriteBOM,
        [switch] $KeepToken
    )
    
    Write-Host "Replacing tokens in file '${Path}'..."
    
    $content = [System.IO.File]::ReadAllText($Path)
    if (!$content)
    {
        Write-Verbose "Skipping empty file."
        return
    }
    
    $replaceCallback = {
        param(
            [System.Text.RegularExpressions.Match] $Match
        )
        
        $value = Get-TaskVariable $distributedTaskContext $Match.Groups[1].Value
        if (!$value)
        {
            if ($KeepToken)
            {
                $value = $Match.Value
            }

            switch ($ActionOnMissing)
            {
                'warn' { Write-Warning "Variable '$($Match.Groups[1].Value)' not found." }
                'fail' { Write-Error "Variable '$($Match.Groups[1].Value)' not found." }
                default { Write-Verbose "Variable '$($Match.Groups[1].Value)' not found." }
            }
        }
        else
        {
            $value = Expand-Variables -Text $value
        }
        
        Write-Verbose "Replacing '$($Match.Value)' with '${value}'"
        $value
    }
    
    $content = $regex.Replace($content, $replaceCallback)
    
    if (!$EncodingName -or $EncodingName -eq "auto")
    {
        $EncodingName = Get-FileEncoding -Path $Path
    }

    $encoding = Get-Encoding -Name $EncodingName -WriteBOM:$WriteBOM
    if (!$encoding)
    {
        Write-Error "Unknown encoding '${EncodingName}'."
        return
    }
    
    $fileInfo = New-Object 'System.IO.FileInfo' $Path
    if ($fileInfo.IsReadOnly)
    {
        Write-Verbose "Removing readonly flag on file '${Path}'."
        $fileInfo.IsReadOnly = $false
    }
    
    Write-Verbose "Using encoding '$($encoding.WebName)' (BOM: ${WriteBOM})"
    [System.IO.File]::WriteAllText($Path, $content, $Encoding)
}