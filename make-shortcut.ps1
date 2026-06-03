Add-Type -AssemblyName System.Drawing

$projectDir = 'C:\Users\fydes\Downloads\Code\Product\SellSignal'
$srcPng     = Join-Path $projectDir 'public\stock.png'
$icoPath    = Join-Path $projectDir 'SellSignal.ico'
$batPath    = Join-Path $projectDir 'SellSignal Dev.bat'
$lnkPath    = Join-Path ([Environment]::GetFolderPath('Desktop')) 'SellSignal Dev.lnk'

# --- Load source image ---
$src = [System.Drawing.Image]::FromFile($srcPng)

# --- Produce a square PNG (transparent padding) at a given size ---
function New-SquarePng([System.Drawing.Image]$img, [int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Fit while preserving aspect ratio, centered
    $scale = [Math]::Min($size / $img.Width, $size / $img.Height)
    $w = [int]($img.Width * $scale)
    $h = [int]($img.Height * $scale)
    $x = [int](($size - $w) / 2)
    $y = [int](($size - $h) / 2)
    $g.DrawImage($img, $x, $y, $w, $h)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    return $ms.ToArray()
}

$sizes = 16, 32, 48, 256
$pngs = foreach ($s in $sizes) { , (New-SquarePng $src $s) }
$src.Dispose()

# --- Assemble a multi-image .ico (each entry stored as PNG) ---
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR header
$bw.Write([UInt16]0)            # reserved
$bw.Write([UInt16]1)            # type = icon
$bw.Write([UInt16]$sizes.Count) # image count

# ICONDIRENTRY table follows header (6) + 16 bytes per entry
$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $data = $pngs[$i]
    $dim = if ($s -ge 256) { 0 } else { $s }   # 0 means 256
    $bw.Write([Byte]$dim)        # width
    $bw.Write([Byte]$dim)        # height
    $bw.Write([Byte]0)           # palette count
    $bw.Write([Byte]0)           # reserved
    $bw.Write([UInt16]1)         # color planes
    $bw.Write([UInt16]32)        # bits per pixel
    $bw.Write([UInt32]$data.Length)
    $bw.Write([UInt32]$offset)
    $offset += $data.Length
}
foreach ($data in $pngs) { $bw.Write($data, 0, $data.Length) }
$bw.Flush(); $bw.Close(); $fs.Close()
Write-Output "ICO created: $icoPath"

# --- Create the .lnk shortcut pointing at the .bat, with the icon ---
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnkPath)
$sc.TargetPath = $batPath
$sc.WorkingDirectory = $projectDir
$sc.IconLocation = "$icoPath,0"
$sc.Description = 'Start SellSignal Vite dev server'
$sc.Save()
Write-Output "LNK created: $lnkPath"
