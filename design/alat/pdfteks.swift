import PDFKit
let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1]))!
for i in 0..<doc.pageCount {
  let t = (doc.page(at: i)?.string ?? "").replacingOccurrences(of: "\n", with: " | ")
  print("=== \(i+1): \(t.prefix(Int(CommandLine.arguments[2]) ?? 300))")
}
