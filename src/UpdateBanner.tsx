import { useEffect, useState } from "react";
import { isNative } from "./native";
import { isNewer } from "./domain/version";

/** In the iPhone app: asks the App Store whether a newer version exists and, if so, shows a bar that opens the App Store page. */
export default function UpdateBanner() {
  const [url, setUrl] = useState<string | null>(null), [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!isNative) return;
    let live = true;
    (async () => {
      try {
        const r = await fetch("https://itunes.apple.com/lookup?bundleId=com.serves20.app");
        const j = await r.json();
        const app = j?.results?.[0];
        if (live && app?.version && isNewer(app.version, __APP_VERSION__)) setUrl(app.trackViewUrl || null);
      } catch { /* offline: no prompt */ }
    })();
    return () => { live = false; };
  }, []);
  if (!url || hidden) return null;
  return (
    <div className="updatebar" role="status">
      <span>A new version of Serves 20 is ready.</span>
      <a href={url} target="_blank" rel="noreferrer">Update</a>
      <button aria-label="Not now" onClick={() => setHidden(true)}>✕</button>
    </div>
  );
}
