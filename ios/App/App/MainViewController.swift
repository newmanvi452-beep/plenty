import UIKit
import Capacitor

/// The app's main screen: Capacitor's web view plus our own purchase plugin.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(StorePlugin())
    }
}
