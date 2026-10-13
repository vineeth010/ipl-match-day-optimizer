Add-Type -AssemblyName System.Drawing

$out = 'F:\Mesa\Term_1\AI\Fantasy_cricket\components_map.png'
$W = 1820; $H = 960
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::White)

function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function Font($size, $bold) {
    $style = [System.Drawing.FontStyle]::Regular
    if ($bold) { $style = [System.Drawing.FontStyle]::Bold }
    New-Object System.Drawing.Font('Segoe UI', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}
$center = New-Object System.Drawing.StringFormat
$center.Alignment = 'Center'; $center.LineAlignment = 'Center'

function RoundRect($x, $y, $w, $h, $r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    $p
}

$arrow = [char]0x2192
$dash = [char]0x2014
$colX = @(215, 479, 743, 1007, 1271, 1535)
$colW = 264
$colNames = @('Trigger', 'Input', 'Context', 'Processing', 'AI', 'Output')
$rowY = @(140, 290, 440, 590, 740)
$rowH = 150
$rowNames = @('Aryan', 'System', 'AI Model', 'Data Sources', 'Database')
$rowSub = @('(User)', '(App Backend)', '(Gemini Flash)', '(Cricsheet + offline)', '(Supabase)')
$rowBg = @('#E8F0FE', '#FFF8DC', '#E8F8EE', '#FDEBF3', '#EDE7F6')
$boxFill = @('#D6E4FF', '#FFE9A8', '#C9F0D6', '#F9CFE2', '#D9CCF2')
$boxLine = @('#3B5BDB', '#E08F00', '#2F9E5B', '#C2417A', '#6741D9')
$navy = C '#14284B'
$hb = New-Object System.Drawing.SolidBrush $navy

$g.DrawString("Fantasy Cricket Match Day Optimizer $dash Components Map", (Font 30 $true), (New-Object System.Drawing.SolidBrush $navy), (New-Object System.Drawing.RectangleF(0, 18, $W, 50)), $center)

$g.FillRectangle($hb, 20, 80, 195, 60)
$g.DrawString('Actor', (Font 22 $true), [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(20, 80, 195, 60)), $center)
for ($i = 0; $i -lt 6; $i++) {
    $g.FillRectangle($hb, $colX[$i], 80, $colW, 60)
    $g.DrawString($colNames[$i], (Font 22 $true), [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF($colX[$i], 80, $colW, 60)), $center)
    $g.DrawLine((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 1)), $colX[$i], 80, $colX[$i], 140)
}

for ($r = 0; $r -lt 5; $r++) {
    $g.FillRectangle((New-Object System.Drawing.SolidBrush (C $rowBg[$r])), 215, $rowY[$r], ($W - 215 - 21), $rowH)
    $g.FillRectangle($hb, 20, $rowY[$r], 195, $rowH)
    $g.DrawString($rowNames[$r], (Font 22 $true), [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(20, ($rowY[$r] + 42), 195, 36)), $center)
    $g.DrawString($rowSub[$r], (Font 16 $false), (New-Object System.Drawing.SolidBrush (C '#C9D3E8')), (New-Object System.Drawing.RectangleF(20, ($rowY[$r] + 78), 195, 28)), $center)
    $g.DrawLine((New-Object System.Drawing.Pen((C '#FFFFFF'), 2)), 20, $rowY[$r], ($W - 21), $rowY[$r])
}
for ($i = 1; $i -lt 6; $i++) {
    $g.DrawLine((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 255, 255), 2)), $colX[$i], 140, $colX[$i], 890)
}

# ---- arrows first (so boxes sit on top) ----
$pen = New-Object System.Drawing.Pen((C '#14284B'), 2.5)
$pen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(5, 6)
$pen2 = New-Object System.Drawing.Pen((C '#14284B'), 2.5)
$pen2.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(5, 6)
$pen2.CustomStartCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(5, 6)
$lblFont = Font 14 $false
$lblBrush = New-Object System.Drawing.SolidBrush (C '#3A3A3A')
function Lbl($x, $y, $t) { $g.DrawString($t, $lblFont, $lblBrush, $x, $y) }
function Cx($col) { $colX[$col] + 132 }
function Pt($x, $y) { New-Object System.Drawing.Point($x, $y) }

# 1 ingestion -> database
$g.DrawLine($pen, (Cx 4), 722, (Cx 4), 763)
# database -> date gate
$g.DrawLine($pen, (Cx 2), 763, (Cx 2), 417)
Lbl ((Cx 2) + 8) 632 'reads only'
Lbl ((Cx 2) + 8) 650 'dated data'
# 3 generate -> date gate
$g.DrawLines($pen, [System.Drawing.Point[]]@((Pt (Cx 0) 267), (Pt (Cx 0) 290), (Pt (Cx 2) 290), (Pt (Cx 2) 313)))
# gate -> engine
$g.DrawLine($pen, 987, 365, 1027, 365)
# engine <-> database
$g.DrawLine($pen2, (Cx 3), 417, (Cx 3), 763)
Lbl ((Cx 3) + 8) 632 'saves predictions,'
Lbl ((Cx 3) + 8) 650 'reads latest weights'
# engine -> gemini
$g.DrawLines($pen, [System.Drawing.Point[]]@((Pt 1251 365), (Pt (Cx 4) 365), (Pt (Cx 4) 450)))
# gemini -> match page
$g.DrawLines($pen, [System.Drawing.Point[]]@((Pt 1515 515), (Pt (Cx 5) 515), (Pt (Cx 5) 267)))
# match page -> dream11 step
$g.DrawLine($pen, 1555, 215, 1517, 215)
# points document -> entry
$g.DrawLines($pen, [System.Drawing.Point[]]@((Pt 459 665), (Pt 479 665), (Pt 479 215), (Pt 497 215)))
# entry -> analyzer
$g.DrawLine($pen, (Cx 1), 267, (Cx 1), 313)
# analyzer <-> database
$g.DrawLine($pen2, (Cx 1), 417, (Cx 1), 763)
Lbl ((Cx 1) + 8) 560 'saves actual points'
Lbl ((Cx 1) + 8) 578 'and new weights'

# ---- boxes ----
function Box-At($row, $x, $y, $w, $h, $num, $text) {
    $path = RoundRect $x $y $w $h 12
    $g.FillPath((New-Object System.Drawing.SolidBrush (C $boxFill[$row])), $path)
    $g.DrawPath((New-Object System.Drawing.Pen((C $boxLine[$row]), 2.5)), $path)
    $rect = New-Object System.Drawing.RectangleF(($x + 10), ($y + 6), ($w - 20), ($h - 12))
    $g.DrawString($text, (Font 15 $false), (New-Object System.Drawing.SolidBrush (C '#1B1B1B')), $rect, $center)
    $g.FillEllipse($hb, ($x - 12), ($y - 12), 28, 28)
    $g.DrawString("$num", (Font 15 $true), [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(($x - 12), ($y - 12), 28, 28)), $center)
}
function Box($row, $col, $num, $text) {
    Box-At $row ($colX[$col] + 20) ($rowY[$row] + 23) 224 104 $num $text
}

Box 0 0 3 'Picks an IPL 2026 match and clicks Generate Team'
Box 0 1 10 'After the match: reads the Actual Points Document and types the points into the app'
Box 0 4 8 "Copies the team into Dream11 himself and plays (outside our app)"
Box 0 5 7 "Match page: best XI, captain / VC, bench with reasons, credits, disclaimer, 'what I learned'"

Box 1 1 11 "Learning analyzer: predicted vs actual (and vs a simple baseline) $arrow new weights for the next match"
Box 1 2 4 'Date gate: only uses data from before this match'
Box 1 3 5 'Prediction engine (latest weights) + team builder: estimated credits, 100 cap, max 7 per team, roles'

Box-At 2 ($colX[4] + 20) 450 224 126 6 'Gemini Flash writes the reasons for picks, bench, captain and VC. At ingestion it also classifies the roles of first-time players'

Box 3 0 9 "Actual Points Document: each player's Dream11 points, made from the scorecard"
Box-At 3 ($colX[4] + 20) 598 224 124 1 'Cricsheet ball-by-ball IPL archive (public, CC BY 3.0), loaded ahead of time and after each match: fixtures, squads, scorecards'

Box-At 4 235 763 1545 104 2 'Supabase database (tables inside one existing project): matches, players, dated stats, predictions, actual points and outcomes, weights (versioned), learning log'

$foot = "Numbers show the order of steps  |  All AI runs on Gemini Flash  |  Hosted on Vercel  |  Aryan submits his team in Dream11 himself; the app never does  |  Dream11 is never accessed or scraped"
$g.DrawString($foot, (Font 17 $false), (New-Object System.Drawing.SolidBrush (C '#3A3A3A')), (New-Object System.Drawing.RectangleF(0, 905, $W, 40)), $center)

$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Copy-Item $out 'F:\Mesa\Term_1\AI\Fantasy_cricket\docs\components_map.png' -Force
$g.Dispose(); $bmp.Dispose()
"saved $out"
