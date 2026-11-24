# powershell completion for __NAME__ -*- shell-script -*-

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

filter ____FN___escapeStringWithSpecialChars {
    $_ -replace '\s|#|@|\$|;|,|''|\{|\}|\(|\)|"|\||<|>|&','`$&'
}

[scriptblock]$____FN__CompleterBlock = {
    param($WordToComplete, $CommandAst, $CursorPosition)

    $Command = "$($CommandAst.CommandElements)"
    if ($Command.Length -gt $CursorPosition) {
        $Command = $Command.Substring(0, $CursorPosition)
    }

    $ShellCompDirectiveError=1
    $ShellCompDirectiveNoSpace=2
    $ShellCompDirectiveNoFileComp=4
    $ShellCompDirectiveFilterFileExt=8
    $ShellCompDirectiveFilterDirs=16
    $ShellCompDirectiveKeepOrder=32

    $Program, $Arguments = $Command.Split(" ", 2)
    $QuotedArgs = if ($Arguments) {
        ($Arguments -split ' ' | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" }) -join ' '
    } else { "" }

    $RequestComp = "& __BIN__ complete '--' $QuotedArgs".TrimEnd()

    if ($WordToComplete -ne "" -and $Arguments) {
        $WordToComplete = $Arguments.Split(" ")[-1]
    }

    $IsEqualFlag = ($WordToComplete -Like "-*=*")
    if ($IsEqualFlag) {
        $Flag, $WordToComplete = $WordToComplete.Split("=", 2)
    }
    $HasTrailingEmptyArg = $QuotedArgs -match "(^| )''$"

    if ($WordToComplete -eq "" -and (-not $IsEqualFlag) -and (-not $HasTrailingEmptyArg)) {
        $RequestComp = "$RequestComp ''"
    }

    Invoke-Expression -OutVariable Out "$RequestComp" 2>&1 | Out-Null
    if (-not $Out) { return }

    [int]$Directive = $Out[-1].TrimStart(':')
    $Out = $Out | Select-Object -SkipLast 1

    if (($Directive -band $ShellCompDirectiveError) -ne 0) { return }
    if ((($Directive -band $ShellCompDirectiveFilterFileExt) -ne 0) -or
        (($Directive -band $ShellCompDirectiveFilterDirs) -ne 0)) { return }

    $Space = if (($Directive -band $ShellCompDirectiveNoSpace) -ne 0) { "" } else { " " }

    [Array]$Values = $Out | ForEach-Object {
        $ItemName, $Description = $_.Split("`t", 2)
        if (-not $Description) { $Description = " " }
        @{ Name = "$ItemName"; Description = "$Description" }
    } | Where-Object {
        $_.Name -like "$WordToComplete*"
    } | ForEach-Object {
        if ($IsEqualFlag) { $_.Name = "$Flag=$($_.Name)" }
        $_
    }

    if (($Directive -band $ShellCompDirectiveKeepOrder) -eq 0) {
        $Values = $Values | Sort-Object -Property Name
    }

    if (($Directive -band $ShellCompDirectiveNoFileComp) -ne 0 -and $Values.Length -eq 0) {
        ""
        return
    }

    $Values | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new(
            ($_.Name | ____FN___escapeStringWithSpecialChars) + $Space,
            $_.Name,
            'ParameterValue',
            $_.Description
        )
    }
}

Register-ArgumentCompleter -CommandName '__NAME__' -ScriptBlock $____FN__CompleterBlock
