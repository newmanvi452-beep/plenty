import Foundation
import Capacitor
import StoreKit
import UIKit

/// Apple in-app purchase (StoreKit 2) for the one-time "Unlock Serves 20" purchase.
/// StoreKit checks Apple's signature on every transaction, so a purchase can't be faked on the phone.
@objc(StorePlugin)
public class StorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StorePlugin"
    public let jsName = "Store"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isPurchased", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    static let productId = "com.serves20.app.unlock"

    private func loadProduct() async throws -> Product? {
        try await Product.products(for: [StorePlugin.productId]).first
    }

    private func owned() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.productID == StorePlugin.productId, t.revocationDate == nil { return true }
        }
        return false
    }

    /// The window the App Store's purchase sheet should appear over (newer iOS versions want this spelled out).
    @MainActor private func activeScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    }

    @objc func product(_ call: CAPPluginCall) {
        Task {
            do {
                guard let p = try await self.loadProduct() else { call.reject("The product isn't available yet."); return }
                call.resolve(["id": p.id, "displayPrice": p.displayPrice])
            } catch { call.reject("Couldn't reach the App Store: \(error.localizedDescription)") }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        Task {
            do {
                guard let p = try await self.loadProduct() else { call.reject("The product isn't available yet."); return }
                let outcome: Product.PurchaseResult
                if #available(iOS 17.0, *), let scene = await self.activeScene() {
                    outcome = try await p.purchase(confirmIn: scene)
                } else {
                    outcome = try await p.purchase()
                }
                switch outcome {
                case .success(let verification):
                    switch verification {
                    case .verified(let t):
                        await t.finish()
                        call.resolve(["status": "purchased"])
                    case .unverified:
                        call.reject("The purchase couldn't be verified.")
                    }
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.reject("The purchase didn't complete.")
                }
            } catch { call.reject("The App Store said: \(error.localizedDescription)") }
        }
    }

    @objc func isPurchased(_ call: CAPPluginCall) {
        Task { call.resolve(["purchased": await self.owned()]) }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do { try await AppStore.sync() } catch { /* fall through to what this device already knows */ }
            call.resolve(["purchased": await self.owned()])
        }
    }
}
