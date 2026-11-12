import PDFKit
import AppKit
// pdfpng <pdf> <outdir> <prefix> <hal1,hal2,...> [lebar]
let a = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let lebar = a.count > 5 ? CGFloat(Double(a[5])!) : 1100
for n in a[4].split(separator: ",").compactMap({ Int($0) }) {
  guard let p = doc.page(at: n - 1) else { continue }
  let b = p.bounds(for: .mediaBox)
  let s = lebar / b.width
  let img = p.thumbnail(of: NSSize(width: b.width * s, height: b.height * s), for: .mediaBox)
  let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(a[2])/\(a[3])-\(n).png"))
  print("\(a[3])-\(n).png", Int(b.width), "x", Int(b.height))
}
