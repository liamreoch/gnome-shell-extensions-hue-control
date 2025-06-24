import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import {SettingsKey as settingsKey} from './settingsKeys.js';
import { getSession } from './session.js';

export function defaultLightIsOn(settings) {
    return new Promise((resolve, reject) => {
        const bridgeIP = settings.get_string(settingsKey.HUB_NETWORK_ADDRESS);
        const username = settings.get_string(settingsKey.HUE_USERNAME);
        const groupId = settings.get_int(settingsKey.DEFAULT_ROOM_ID);

        const url = `http://${bridgeIP}/api/${username}/groups/${groupId}`;

        const session = getSession();
        const message = Soup.Message.new('GET', url);

        session.send_and_read_async(message, 0, null, (source, result) => {
            try {
                const stream = session.send_and_read_finish(result);
                const bytes = stream.get_data();
                const text = new TextDecoder().decode(bytes);

                if (message.get_status() !== Soup.Status.OK) {
                    return reject(new Error(`Request failed: ${message.get_status()}`));
                }

                const data = JSON.parse(text);
                const isOn = data.state?.any_on === true;
                
                resolve(isOn);
            } catch (e) {
                reject(e);
            }
        });
    });
}

export async function toggleLights(settings) {
    try {
        const groupId = settings.get_int(settingsKey.DEFAULT_ROOM_ID);

        // No default room, no selection made
        if (groupId === -1) { return; }

        const bridgeIP = settings.get_string(settingsKey.HUB_NETWORK_ADDRESS);
        const username = settings.get_string(settingsKey.HUE_USERNAME);

        const isCurrentlyOn = await defaultLightIsOn(settings);
        const turnOn = !isCurrentlyOn;

        const url = `http://${bridgeIP}/api/${username}/groups/${groupId}/action`;
        const body = JSON.stringify({ on: turnOn });
        const bytes = new GLib.Bytes(new TextEncoder().encode(body));

        const session = getSession();
        const message = Soup.Message.new("PUT", url);
        message.set_request_body_from_bytes('application/json', bytes);

        session.send_and_read_async(message, 0, null, (source, result) => {
            try {
                const stream = session.send_and_read_finish(result);
                const data = stream.get_data();
                const text = new TextDecoder().decode(data);

                if (message.get_status() !== Soup.Status.OK) {
                    throw new Error(`Hue request failed: ${message.get_status()}`);
                }

                const response = JSON.parse(text);
                if (!Array.isArray(response) || !response[0]?.success) {
                    console.log(`Unexpected Hue response: ${text}`);
                }
            } catch (error) {
                console.error(error, `Failed to toggle light for room ${groupId}`);
            }
        });

    } catch (error) {
        console.error(error, "Light toggle failed while checking room status");
    }
}

