// Code-native adaptation of Semester's existing public/favicon.svg.
// Run from mobile/: swift scripts/make-icon.swift
import AppKit
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024,
  bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
  colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
let transform = AffineTransform(scale: 32)
NSAffineTransform(transform: transform).concat()
NSColor(calibratedRed: 0.333, green: 0.286, blue: 0.647, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: 32, height: 32)).fill()
NSColor.white.setStroke()
let box = NSBezierPath(roundedRect: NSRect(x: 7, y: 6, width: 18, height: 18), xRadius: 3, yRadius: 3)
box.lineWidth = 1.8
box.stroke()
let lines = NSBezierPath()
lines.lineWidth = 1.8
lines.lineCapStyle = .round
lines.lineJoinStyle = .round
lines.move(to: NSPoint(x: 7, y: 18)); lines.line(to: NSPoint(x: 25, y: 18))
lines.move(to: NSPoint(x: 12, y: 21)); lines.line(to: NSPoint(x: 12, y: 27))
lines.move(to: NSPoint(x: 20, y: 21)); lines.line(to: NSPoint(x: 20, y: 27))
lines.move(to: NSPoint(x: 11, y: 12)); lines.line(to: NSPoint(x: 14, y: 9)); lines.line(to: NSPoint(x: 20, y: 15))
lines.stroke()
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "assets/icon.png"))
