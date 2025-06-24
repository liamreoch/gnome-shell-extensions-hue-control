import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import { getSession } from './session.js';


/**
 * Check if the Hue bridge is reachable and responding to /config.
 * Returns `true` if it responds with a valid config JSON object.
 */
export function isBridgeAvailable(bridgeIP) {
    return new Promise((resolve) => {
        if (!bridgeIP) {
            resolve(false);
            return;
        }

        const session = getSession();
        const url = `http://${bridgeIP}/api/config`;
        const message = Soup.Message.new('GET', url);

        session.send_and_read_async(message, 0, null, (source, result) => {
            try {
                const stream = session.send_and_read_finish(result);
                const bytes = stream.get_data();
                const text = new TextDecoder().decode(bytes);

                if (message.get_status() !== Soup.Status.OK) {
                    console.log(`Bridge unavailable (status: ${message.get_status()})`);
                    resolve(false);
                    return;
                }

                const data = JSON.parse(text);
                const valid = typeof data === 'object' && data.name !== undefined;
                resolve(valid);
            } catch (error) {
                console.log(error, 'Failed to reach or parse Hue bridge /config');
                resolve(false);
            }
        });
    });
}
