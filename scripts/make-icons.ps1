$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$px, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($px, $px)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $sc = $px / 512.0
  $half = [float]($px / 2)

  # rounded background
  $rr = [int](112 * $sc)
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddArc(0, 0, 2 * $rr, 2 * $rr, 180, 90)
  $gp.AddArc($px - 2 * $rr, 0, 2 * $rr, 2 * $rr, 270, 90)
  $gp.AddArc($px - 2 * $rr, $px - 2 * $rr, 2 * $rr, 2 * $rr, 0, 90)
  $gp.AddArc(0, $px - 2 * $rr, 2 * $rr, 2 * $rr, 90, 90)
  $gp.CloseFigure()

  # dark radial background
  $r0 = New-Object System.Drawing.RectangleF(0, 0, $px, $px)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r0, [System.Drawing.Color]::FromArgb(255, 14, 30, 58), [System.Drawing.Color]::FromArgb(255, 3, 8, 16), 65)
  $g.FillPath($bg, $gp)
  $bg.Dispose()

  # soft blue glow behind hands
  for ($i = 0; $i -lt 6; $i++) {
    $a = [int](45 - $i * 7)
    if ($a -lt 0) { $a = 0 }
    $c = [System.Drawing.Color]::FromArgb($a, 91, 200, 248)
    $br = New-Object System.Drawing.SolidBrush($c)
    $d = [float]((100 + $i * 30) * $sc)
    $g.FillEllipse($br, $half - $d, $half - $d * 0.8, 2 * $d, 1.6 * $d)
    $br.Dispose()
  }

  # stars
  $starColor = [System.Drawing.Color]::FromArgb(180, 224, 238, 255)
  $sp = New-Object System.Drawing.SolidBrush($starColor)
  $stars = @(
    @(80, 65, 2.5), @(175, 42, 1.8), @(310, 55, 2.2), @(420, 78, 2.8),
    @(460, 145, 1.6), @(50, 195, 2), @(95, 290, 1.5), @(465, 310, 1.8),
    @(45, 385, 2.4), @(470, 420, 2), @(70, 470, 1.5), @(455, 475, 1.8)
  )
  foreach ($s in $stars) {
    $cx = [float]($s[0] * $sc)
    $cy = [float]($s[1] * $sc)
    $r = [float]($s[2] * $sc)
    $g.FillEllipse($sp, $cx - $r, $cy - $r, 2 * $r, 2 * $r)
  }
  $sp.Dispose()

  # praying hands silhouette (simplified teardrop shape)
  $handPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $handPath.StartFigure()

  # left edge: wrist bottom-left to fingertip
  $handPath.AddBezier(
    (180 * $sc), (460 * $sc),
    (170 * $sc), (440 * $sc),
    (168 * $sc), (395 * $sc),
    (180 * $sc), (355 * $sc)
  )
  $handPath.AddBezier(
    (180 * $sc), (355 * $sc),
    (190 * $sc), (320 * $sc),
    (210 * $sc), (280 * $sc),
    (230 * $sc), (250 * $sc)
  )
  $handPath.AddBezier(
    (230 * $sc), (250 * $sc),
    (242 * $sc), (232 * $sc),
    (250 * $sc), (225 * $sc),
    (256 * $sc), (222 * $sc)
  )

  # right edge: fingertip back down
  $handPath.AddBezier(
    (256 * $sc), (222 * $sc),
    (262 * $sc), (225 * $sc),
    (270 * $sc), (232 * $sc),
    (282 * $sc), (250 * $sc)
  )
  $handPath.AddBezier(
    (282 * $sc), (250 * $sc),
    (302 * $sc), (280 * $sc),
    (322 * $sc), (320 * $sc),
    (332 * $sc), (355 * $sc)
  )
  $handPath.AddBezier(
    (332 * $sc), (355 * $sc),
    (344 * $sc), (395 * $sc),
    (342 * $sc), (440 * $sc),
    (332 * $sc), (460 * $sc)
  )
  $handPath.CloseFigure()

  # hands gradient
  $hx = [float](160 * $sc); $hy = [float](220 * $sc); $hw = [float](192 * $sc); $hh = [float](240 * $sc)
  $handR = New-Object System.Drawing.RectangleF($hx, $hy, $hw, $hh)
  $handBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($handR,
    [System.Drawing.Color]::FromArgb(255, 26, 106, 170),
    [System.Drawing.Color]::FromArgb(255, 255, 255, 255), 90)
  $g.FillPath($handBrush, $handPath)
  $handBrush.Dispose()

  # forearms
  $ax = [float](130 * $sc); $ay = [float](440 * $sc); $aw = [float](80 * $sc); $ah = [float](72 * $sc)
  $armBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.RectangleF($ax, $ay, $aw, $ah)),
    [System.Drawing.Color]::FromArgb(255, 26, 106, 170),
    [System.Drawing.Color]::FromArgb(255, 77, 184, 240), 90)
  $penArm = New-Object System.Drawing.Pen($armBrush, [float](52 * $sc))
  $penArm.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($penArm, (200 * $sc), (450 * $sc), (155 * $sc), (510 * $sc))
  $g.DrawLine($penArm, (312 * $sc), (450 * $sc), (357 * $sc), (510 * $sc))
  $penArm.Dispose()
  $armBrush.Dispose()

  # finger seam lines
  $penSeam = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(115, 12, 62, 106), [float](3.5 * $sc))
  $penSeam.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($penSeam, (256 * $sc), (235 * $sc), (256 * $sc), (445 * $sc))
  $g.DrawLine($penSeam, (240 * $sc), (260 * $sc), (240 * $sc), (358 * $sc))
  $g.DrawLine($penSeam, (272 * $sc), (260 * $sc), (272 * $sc), (358 * $sc))
  $penSeam.Dispose()

  $handPath.Dispose()
  $gp.Dispose()
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-Item -ItemType Directory -Force -Path 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons' | Out-Null
New-Icon 512 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons\icon-512.png'
New-Icon 192 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons\icon-192.png'
New-Icon 180 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons\apple-touch-icon-180.png'
Write-Output 'icons done'
