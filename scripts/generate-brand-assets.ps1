Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$iconDirectory = Join-Path $repoRoot "public\appicon"
$iosIconPath = Join-Path $repoRoot "ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png"
$splashDirectory = Join-Path $repoRoot "ios\App\App\Assets.xcassets\Splash.imageset"

function Get-BrandColor([string]$hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-StarPath(
  [float]$centerX,
  [float]$centerY,
  [float]$outerHorizontal,
  [float]$outerVertical,
  [float]$innerHorizontal,
  [float]$innerVertical
) {
  $points = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($centerX, $centerY - $outerVertical),
    [System.Drawing.PointF]::new($centerX + $innerHorizontal, $centerY - $innerVertical),
    [System.Drawing.PointF]::new($centerX + $outerHorizontal, $centerY),
    [System.Drawing.PointF]::new($centerX + $innerHorizontal, $centerY + $innerVertical),
    [System.Drawing.PointF]::new($centerX, $centerY + $outerVertical),
    [System.Drawing.PointF]::new($centerX - $innerHorizontal, $centerY + $innerVertical),
    [System.Drawing.PointF]::new($centerX - $outerHorizontal, $centerY),
    [System.Drawing.PointF]::new($centerX - $innerHorizontal, $centerY - $innerVertical)
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddPolygon($points)
  return $path
}

function New-BrandCanvas([int]$size, [switch]$Splash) {
  $bitmap = [System.Drawing.Bitmap]::new(
    $size,
    $size,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $backgroundStart = Get-BrandColor "#FCFBFF"
  $backgroundEnd = Get-BrandColor "#EDE9FF"
  $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($size, $size),
    $backgroundStart,
    $backgroundEnd
  )
  $graphics.FillRectangle($backgroundBrush, 0, 0, $size, $size)

  $ambientBrush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.Color]::FromArgb(72, 255, 255, 255)
  )
  $graphics.FillEllipse($ambientBrush, -0.14 * $size, -0.18 * $size, 0.76 * $size, 0.76 * $size)

  if ($Splash) {
    $centerX = 0.47 * $size
    $centerY = 0.47 * $size
    $largeHorizontal = 0.155 * $size
    $largeVertical = 0.165 * $size
    $largeInnerHorizontal = 0.046 * $size
    $largeInnerVertical = 0.047 * $size
    $smallCenterX = 0.64 * $size
    $smallCenterY = 0.385 * $size
    $smallHorizontal = 0.047 * $size
    $smallVertical = 0.052 * $size
    $smallInnerHorizontal = 0.018 * $size
    $smallInnerVertical = 0.019 * $size
    $shadowOffset = 0.012 * $size
  } else {
    $centerX = 0.43 * $size
    $centerY = 0.54 * $size
    $largeHorizontal = 0.315 * $size
    $largeVertical = 0.335 * $size
    $largeInnerHorizontal = 0.085 * $size
    $largeInnerVertical = 0.088 * $size
    $smallCenterX = 0.755 * $size
    $smallCenterY = 0.34 * $size
    $smallHorizontal = 0.105 * $size
    $smallVertical = 0.112 * $size
    $smallInnerHorizontal = 0.038 * $size
    $smallInnerVertical = 0.04 * $size
    $shadowOffset = 0.016 * $size
  }

  $shadowPath = New-StarPath `
    ($centerX + $shadowOffset) `
    ($centerY + $shadowOffset) `
    $largeHorizontal `
    $largeVertical `
    $largeInnerHorizontal `
    $largeInnerVertical
  $shadowBrush = [System.Drawing.SolidBrush]::new(
    [System.Drawing.Color]::FromArgb(34, 36, 30, 53)
  )
  $graphics.FillPath($shadowBrush, $shadowPath)

  $largePath = New-StarPath `
    $centerX `
    $centerY `
    $largeHorizontal `
    $largeVertical `
    $largeInnerHorizontal `
    $largeInnerVertical
  $largeBounds = $largePath.GetBounds()
  $largeBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.PointF]::new($largeBounds.Left, $largeBounds.Top),
    [System.Drawing.PointF]::new($largeBounds.Right, $largeBounds.Bottom),
    (Get-BrandColor "#8B7FF0"),
    (Get-BrandColor "#6757D9")
  )
  $graphics.FillPath($largeBrush, $largePath)

  $smallPath = New-StarPath `
    $smallCenterX `
    $smallCenterY `
    $smallHorizontal `
    $smallVertical `
    $smallInnerHorizontal `
    $smallInnerVertical
  $smallBrush = [System.Drawing.SolidBrush]::new((Get-BrandColor "#EF5F7A"))
  $graphics.FillPath($smallBrush, $smallPath)

  $smallBrush.Dispose()
  $smallPath.Dispose()
  $largeBrush.Dispose()
  $largePath.Dispose()
  $shadowBrush.Dispose()
  $shadowPath.Dispose()
  $ambientBrush.Dispose()
  $backgroundBrush.Dispose()
  $graphics.Dispose()

  return $bitmap
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Resize-Bitmap([System.Drawing.Bitmap]$source, [int]$size) {
  $resized = [System.Drawing.Bitmap]::new(
    $size,
    $size,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($resized)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($source, 0, 0, $size, $size)
  $graphics.Dispose()
  return $resized
}

New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null

$masterIcon = New-BrandCanvas 1024
$iconSizes = @(16, 20, 29, 32, 40, 58, 60, 76, 80, 87, 120, 144, 152, 167, 180, 192, 512, 1024)

foreach ($size in $iconSizes) {
  $outputPath = Join-Path $iconDirectory "icon-$size.png"
  if ($size -eq 1024) {
    Save-Png $masterIcon $outputPath
  } else {
    $resizedIcon = Resize-Bitmap $masterIcon $size
    Save-Png $resizedIcon $outputPath
    $resizedIcon.Dispose()
  }
}

Copy-Item (Join-Path $iconDirectory "icon-1024.png") $iosIconPath -Force
$masterIcon.Dispose()

$splash = New-BrandCanvas 2732 -Splash
foreach ($fileName in @("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png")) {
  Save-Png $splash (Join-Path $splashDirectory $fileName)
}
$splash.Dispose()

Write-Host "Generated NYX app icons and iOS splash screens in the porcelain violet palette."
