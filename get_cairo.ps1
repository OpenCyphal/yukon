Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
function Get-And-Unpack-Cairo {
    $file_name = "cairo-1.16.0.tar.xz"
    $source_address = "http://www.cairographics.org/releases/" + $file_name
    $destination_directory = "lib/libcairo/"
    $destination_location = $destination_directory + $file_name
    Set-ItemProperty -Path $destination_location -Name IsReadOnly -Value $false

    try {
        Invoke-WebRequest -Uri $source_address -OutFile $destination_location
        tar -xvzf $destination_location -C $destination_directory
    } catch [System.Net.WebException] {
        Write-Output "There was a web exception"
        Write-Output $_
    }
}
function Is-MozillaBuild-Installed {
    return (Test-Path -Path "c:\mozilla-build" -PathType Container)
}
function Is-MozillaBuild-Setup-Downloaded {
    $downloaded_file_name = "MozillaBuildSetup-4.0.exe"
    $path = "lib/libcairo/" + $downloaded_file_name
    return (Test-Path -Path $path -PathType Leaf)
}
function Get-MozillaBuild-Setup {
    $downloaded_file_name = "MozillaBuildSetup-4.0.exe"
    $destination_directory = "lib/libcairo/" 
    $destination_location = $destination_directory + $downloaded_file_name
    $download_link = "https://ftp.mozilla.org/pub/mozilla/libraries/win32/" + $downloaded_file_name
    Invoke-WebRequest -Uri $download_link -OutFile $destination_location
    
}
function Run-MozillaBuild-Setup {
    .\lib\libcairo\MozillaBuildSetup-4.0.exe
}
try {
    if( -not (Is-MozillaBuild-Setup-Downloaded)) 
    {
        Get-MozillaBuild-Setup
    }
    if( -not (Is-MozillaBuild-Installed))
    {
        Run-MozillaBuild-Setup
    } else
    {
        Write-Output "Mozilla-build setup was not run because it is already installed."
    }
} catch [NativeCommandFailed] {
    Write-Output "You cancelled the setup of MozillaBuild"
}
