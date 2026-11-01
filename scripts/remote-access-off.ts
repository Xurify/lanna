/**
 * `npm run remote:off`: turns remote access off and signs every paired device
 * out. Run it on the computer when every device is locked out (E21). It works
 * on the real data folder, so it needs no window and no pairing.
 */
import { disableRemoteAccess } from "../src/server/remote-access-store.ts";

await disableRemoteAccess();
console.log("Remote access is off, and every paired device is signed out. Turn it on again in Settings → Devices.");
