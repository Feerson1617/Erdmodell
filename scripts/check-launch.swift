// Identify the exact copied bundle even when LaunchServices canonicalises /var paths.
import AppKit
let url = URL(fileURLWithPath: CommandLine.arguments[1]).resolvingSymlinksInPath().standardizedFileURL
let deadline = Date().addingTimeInterval(45)
var running: NSRunningApplication?
repeat {
    running = NSWorkspace.shared.runningApplications.first {
        $0.bundleIdentifier == "de.georisiko.observatorium" &&
        $0.bundleURL?.resolvingSymlinksInPath().standardizedFileURL.path == url.path
    }
    if running?.isFinishedLaunching == true { break }
    RunLoop.current.run(until: Date().addingTimeInterval(0.25))
} while Date() < deadline
guard let app = running, app.isFinishedLaunching else { fatalError("Keine gestartete Kopie im Programme-Testordner") }
print("LaunchServices-PID", app.processIdentifier)
guard app.terminate() else { fatalError("macOS hat Beenden abgelehnt") }
let end = Date().addingTimeInterval(25)
while !app.isTerminated && Date() < end { RunLoop.current.run(until: Date().addingTimeInterval(0.25)) }
guard app.isTerminated else { fatalError("Prozess nach Beenden weiterhin aktiv") }
