import { Capacitor, registerPlugin } from "@capacitor/core";

/** True inside the iPhone app (the Capacitor shell); false on the website. */
export const isNative = Capacitor.isNativePlatform();
/** Links people share or sign in through must point at the real website, not the app's internal address. */
export const SITE = "https://serves20.com/";
export const siteBase = () => (isNative ? SITE : `${location.origin}${location.pathname}`);

export interface StoreApi {
  product(): Promise<{ id: string; displayPrice: string }>;
  purchase(): Promise<{ status: "purchased" | "cancelled" | "pending" }>;
  isPurchased(): Promise<{ purchased: boolean }>;
  restore(): Promise<{ purchased: boolean }>;
}
/** Apple in-app purchase (StoreKit 2), implemented in ios/App/App/StorePlugin.swift. */
export const Store = registerPlugin<StoreApi>("Store");
