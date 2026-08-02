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

  $r0 = New-Object System.Drawing.RectangleF(0, 0, $px, $px)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r0, [System.Drawing.Color]::FromArgb(255, 30, 46, 99), [System.Drawing.Color]::FromArgb(255, 6, 10, 26), 65)
  $g.FillPath($bg, $gp)

  # gold glow rings
  for ($i = 0; $i -lt 9; $i++) {
    $a = 95 - $i * 11
    if ($a -lt 0) { $a = 0 }
    $c = [System.Drawing.Color]::FromArgb($a, 232, 196, 122)
    $br = New-Object System.Drawing.SolidBrush($c)
    $d = [float]((150 + $i * 26) * $sc)
    $g.FillEllipse($br, $half - $d, $half - $d, 2 * $d, 2 * $d)
    $br.Dispose()
  }

  # dark earth
  $earthD = [float](300 * $sc)
  $ex = $half - $earthD / 2
  $ey = $half - $earthD / 2
  $dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 15, 43))
  $g.FillEllipse($dark, $ex, $ey, $earthD, $earthD)
  $dark.Dispose()

  # ocean gradient
  $er = New-Object System.Drawing.RectangleF($ex, $ey, $earthD, $earthD)
  $ocean = New-Object System.Drawing.Drawing2D.LinearGradientBrush($er, [System.Drawing.Color]::FromArgb(255, 63, 118, 232), [System.Drawing.Color]::FromArgb(255, 22, 48, 110), 90)
  $g.FillEllipse($ocean, $ex, $ey, $earthD, $earthD)
  $ocean.Dispose()

  # land
  $l1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 58, 125, 74))
  $g.FillEllipse($l1, $half - 120 * $sc, $half - 95 * $sc, 160 * $sc, 115 * $sc)
  $g.FillEllipse($l1, $half - 80 * $sc, $half - 20 * $sc, 95 * $sc, 70 * $sc)
  $g.FillEllipse($l1, $half + 40 * $sc, $half + 60 * $sc, 60 * $sc, 42 * $sc)
  $l1.Dispose()
  $l2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 44, 96, 60))
  $g.FillEllipse($l2, $half - 105 * $sc, $half - 82 * $sc, 110 * $sc, 60 * $sc)
  $l2.Dispose()

  # city sparkles
  $sp = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 245, 215, 130))
  $g.FillEllipse($sp, $half - 45 * $sc, $half - 55 * $sc, 6 * $sc, 6 * $sc)
  $g.FillEllipse($sp, $half + 5 * $sc, $half - 5 * $sc, 5 * $sc, 5 * $sc)
  $g.FillEllipse($sp, $half - 15 * $sc, $half + 30 * $sc, 5 * $sc, 5 * $sc)
  $g.FillEllipse($sp, $half + 55 * $sc, $half - 20 * $sc, 4 * $sc, 4 * $sc)
  $sp.Dispose()

  # orbit rings
  $pA = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 143, 176, 255), [float](2 * $sc))
  $g.DrawEllipse($pA, $half - 300 * $sc, $half - 300 * $sc, 600 * $sc, 600 * $sc)
  $pA.Dispose()
  $pB = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 232, 196, 122), [float](2 * $sc))
  $pB.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  $g.DrawEllipse($pB, $half - 350 * $sc, $half - 350 * $sc, 700 * $sc, 700 * $sc)
  $pB.Dispose()

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-Item -ItemType Directory -Force -Path 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons' | Out-Null
New-Icon 512 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons\icon-512.png'
New-Icon 192 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons\icon-192.png'
New-Icon 180 'C:\Users\j\Documents\Default Project\prayer-earth\public\icons\apple-touch-icon-180.png'
Write-Output 'icons done'
