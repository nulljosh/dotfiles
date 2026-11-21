import CoreGraphics
import Foundation
func ev(_ t: CGEventType, _ p: CGPoint) { CGEvent(mouseEventSource: nil, mouseType: t, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap) }
let row = CGPoint(x: 1000, y: 685)
for i in 0..<6 { ev(.mouseMoved, CGPoint(x: 960 + CGFloat(i) * 8, y: 685)); usleep(100000) }
usleep(600000)
let btn = CGPoint(x: 1268, y: 685)
ev(.mouseMoved, btn); usleep(500000)
ev(.leftMouseDown, btn); usleep(80000); ev(.leftMouseUp, btn)
