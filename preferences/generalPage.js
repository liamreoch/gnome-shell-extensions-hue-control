/* exported GeneralPage */
"use strict";

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import {gettext as _} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import {isBridgeAvailable} from "../utils/networkTools.js";

export var GeneralPage = GObject.registerClass(
    class HueGeneralPage extends Adw.PreferencesPage {
        _init(settings, settingsKey) {
            super._init({
                title: _("General"),
                icon_name: "general-symbolic",
                name: "GeneralPage",
            });
            this._settings = settings;
            this._settingsKey = settingsKey;

            const storedIP = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);

            // Helper to handle discovery and pick a bridge IP or fail
            const discoverBridge = () => {
                return this._fetchBridgeInfoPromise()
                    .then(bridges => {
                        if (!bridges || bridges.length === 0) {
                            return Promise.reject(new Error('No bridges found on the network'));
                        }
                        return bridges[0].internalipaddress;
                    });
            };

            // Start with stored IP or discovery
            const bridgeIPPromise = storedIP && storedIP !== ''
                ? Promise.resolve(storedIP)
                : discoverBridge();

            bridgeIPPromise
                .then((bridgeIP) => {
                    // Save bridgeIP to settings if we discovered it
                    if (bridgeIP !== storedIP) {
                        this._settings.set_string(this._settingsKey.HUB_NETWORK_ADDRESS, bridgeIP);
                    }

                    // Check if the bridge is actually reachable
                    return isBridgeAvailable(bridgeIP)
                        .then((available) => {
                            if (!available) {
                                return Promise.reject(new Error('Bridge unavailable'));
                            }
                            // Build the connection UI early
                            this._createHubConnectionUI();
                            return bridgeIP;
                        });
                })
                .then(() => {
                    // Load rooms UI only if bridge is available
                    return this._loadRoomsUI();
                })
                .catch((error) => {
                    logError(error, 'Initialization failed or no bridge found');

                    // Display error UI
                    this._showBridgeUnavailableMessage();
                });
        }



        // _fetchBridgeInfoPromise() {
        //     return new Promise((resolve, reject) => {
        //         this._fetchBridgeInfo((error, data) => {
        //             if (error) {
        //                 reject(error);
        //             } else {
        //                 resolve(data);
        //             }
        //         });
        //     });
        // }

        _fetchBridgeInfoPromise() {
            const url = "https://discovery.meethue.com/";
            const session = new Soup.Session();
            const message = Soup.Message.new('GET', url);

            return new Promise((resolve, reject) => {
                session.send_and_read_async(message, 0, null, (source, result) => {
                    try {
                        const stream = session.send_and_read_finish(result);
                        const bytes = stream.get_data();
                        const text = new TextDecoder().decode(bytes);

                        if (message.get_status() !== Soup.Status.OK) {
                            reject(new Error(`Request failed with status ${message.get_status()}`));
                            return;
                        }

                        let data = JSON.parse(text);

                        if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== 'object') {
                            // No Hue Bridge found on this network
                            resolve([]); // resolve empty array — no error, just no bridges
                            return;
                        }

                        resolve(data); // resolve the full array of bridges

                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }

        _createHubConnectionUI() {
            return new Promise(resolve => {
                let hubConnectionGroup = new Adw.PreferencesGroup({
                    title: _("Hub Connection"),
                });

                let connectButton = new Gtk.Button({
                    child: new Adw.ButtonContent({
                        icon_name: 'list-add-symbolic',
                        label: _('Connect')
                    })
                });

                connectButton.connect('clicked', this._onConnectToHub.bind(this));

                hubConnectionGroup.add(connectButton);
                this.add(hubConnectionGroup);

                resolve();
            });
        }

        // Promise returning function for _getHueRooms
        _getHueRoomsPromise() {
            return new Promise((resolve, reject) => {
                this._getHueRooms(
                    rooms => resolve(rooms),
                    error => reject(error)
                );
            });
        }

        _loadRoomsUI() {
            if (!this._keyValuesExist()) {
                return Promise.resolve();
            }

            return this._getHueRoomsPromise()
                .then(rooms => {
                    if (rooms.length === 0) return;

                    // Default room Group
                    let defaultRoomGroup = new Adw.PreferencesGroup({
                        title: _("Default room"),
                    });

                    let roomStore = new Gtk.StringList();
                    const roomIds = [];

                    for (const room of rooms) {
                        roomStore.append(_(room.name));
                        roomIds.push(parseInt(room.id));
                    }

                    const defaultRoom = this._settings.get_int(this._settingsKey.DEFAULT_ROOM_ID);
                    const selectedDefault = roomIds.indexOf(defaultRoom);

                    let defaultRoomRow = new Adw.ComboRow({
                        title: _('Default Room'),
                        subtitle: _('The room that responds to the menu light toggle'),
                        model: roomStore,
                        selected: selectedDefault,
                    });

                    defaultRoomRow.connect("notify::selected", () => {
                        const index = defaultRoomRow.selected;
                        const selectedRoomName = rooms[index].name;
                        const selectedRoomId = roomIds[index];

                        this._settings.set_int(this._settingsKey.DEFAULT_ROOM_ID, selectedRoomId);
                        this._settings.set_string(this._settingsKey.DEFAULT_ROOM_NAME, selectedRoomName);
                    });

                    defaultRoomGroup.add(defaultRoomRow);
                    this.add(defaultRoomGroup);

                    // Rooms group
                    let roomsGroup = new Adw.PreferencesGroup({
                        title: _("Rooms"),
                    });

                    for (const room of rooms) {
                        const row = new Adw.SwitchRow({
                            title: room.name,
                            active: room.state.any_on,
                        });

                        row.id = room.id;

                        row.connect('notify::active', (sw) => {
                            this._toggleRoomLight(row.id, sw.active);
                        });

                        roomsGroup.add(row);
                    }

                    this.add(roomsGroup);
                });
        }

        _keyValuesExist() {
            const defaultRoomId = this._settings.get_int(this._settingsKey.DEFAULT_ROOM_ID);
            const defaultRoomName = this._settings.get_string(this._settingsKey.DEFAULT_ROOM_NAME);
            const hueNetworkAddress = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);
            const hueUsername = this._settings.get_string(this._settingsKey.HUE_USERNAME);

            return (hueNetworkAddress !== '' && hueUsername !== '');
        }

        // _fetchBridgeInfo() {
        //     const url = "https://discovery.meethue.com/";
        //
        //     const session = new Soup.Session();
        //     const message = Soup.Message.new('GET', url);
        //
        //     session.send_and_read_async(
        //         message,
        //         // GLib.PRIORITY_DEFAULT,
        //         0,
        //         null,
        //         (source, result) => {
        //             try {
        //                 const stream = session.send_and_read_finish(result);
        //                 const bytes = stream.get_data();
        //                 const text = new TextDecoder().decode(bytes);
        //
        //                 if (message.get_status() !== Soup.Status.OK) {
        //                     throw new Error(`Request failed with status ${message.get_status()}`);
        //                 }
        //
        //                 let data = JSON.parse(text);
        //
        //                 if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== 'object') {
        //                     // No Hue Bridge found on this network
        //                     throw new Error('Expected a non-empty array of JSON objects');
        //                 }
        //
        //                 let hubInfo = data[0];
        //
        //                 // Update key value in schema
        //                 this._settings.set_string(this._settingsKey.HUB_NETWORK_ADDRESS, hubInfo.internalipaddress);
        //
        //             } catch (error) {
        //                 logError(error, "Failed to fetch bridge info");
        //             }
        //         }
        //     );
        // }

        _showBridgeUnavailableMessage() {
            const errorGroup = new Adw.PreferencesGroup({
                title: _("Connection error"),
                visible: true,
            });

            const label = new Gtk.Label({
                label: _("No Philips Hue bridge could be found or connected to on your network."),
                wrap: true,
                margin_top: 12,
                margin_bottom: 12,
            });

            errorGroup.add(label);
            this.add(errorGroup);
        }

        _getHueRooms(callback, errorCallback = null) {
            // const Soup = imports.gi.Soup;
            // const GLib = imports.gi.GLib;

            const session = new Soup.Session();

            const bridgeIP = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);
            const username = this._settings.get_string(this._settingsKey.HUE_USERNAME);
            const url = `http://${bridgeIP}/api/${username}/groups`;

            const message = Soup.Message.new("GET", url);

            session.send_and_read_async(
                message,
                0,
                null,
                (source, result) => {
                    try {
                        const stream = session.send_and_read_finish(result);
                        const data = stream.get_data();
                        const text = new TextDecoder().decode(data);

                        if (message.get_status() !== Soup.Status.OK) {
                            throw new Error(`GET failed with status ${message.get_status()}`);
                        }

                        const groups = JSON.parse(text);
                        const rooms = [];

                        for (let [id, group] of Object.entries(groups)) {
                            if (group.type === "Room") {
                                rooms.push({
                                    id,
                                    name: group.name,
                                    lights: group.lights,
                                    class: group.class,
                                    state: group.state
                                });
                            }
                        }

                        if (callback)
                            callback(rooms);

                    } catch (e) {
                        logError(e, 'Failed to fetch Hue rooms');
                        if (errorCallback)
                            errorCallback(e);
                    }
                }
            );
        }

        _registerWithBridge(successCallback, errorCallback = null) {
            // const Soup = imports.gi.Soup;
            // const GLib = imports.gi.GLib;

            const session = new Soup.Session();
            const bridgeIPAddr = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);
            const url = `http://${bridgeIPAddr}/api`;
            const body = JSON.stringify({devicetype: "gnome_hue_extension#fedora"});
            const bytes = new GLib.Bytes(new TextEncoder().encode(body));

            let attemptCount = 0;
            const maxAttempts = 15;
            const retryInterval = 2; // Seconds

            const tryRegister = () => {
                const message = Soup.Message.new("POST", url);
                message.set_request_body_from_bytes('application/json', bytes);

                session.send_and_read_async(
                    message,
                    0,
                    null,
                    (source, result) => {
                        try {
                            const stream = session.send_and_read_finish(result);
                            const responseBytes = stream.get_data();
                            const text = new TextDecoder().decode(responseBytes);

                            if (message.get_status() !== Soup.Status.OK) {
                                throw new Error(`POST failed with status ${message.get_status()}`);
                            }

                            const data = JSON.parse(text);

                            if (Array.isArray(data) && data[0].success) {
                                const username = data[0].success.username;

                                // Save in schema
                                this._settings.set_string(this._settingsKey.HUE_USERNAME, username);

                                if (successCallback) {
                                    successCallback(username);
                                }
                                return GLib.SOURCE_REMOVE; // Stop retrying
                            } else if (data[0]?.error?.type === 101) {
                                // Link button not pressed yet, keep retrying
                            } else if (data[0]?.error) {
                                const error = new Error(data[0].error.description);
                                logError(error, 'Bridge registration error');

                                if (errorCallback) {
                                    errorCallback(error);
                                }

                                return GLib.SOURCE_REMOVE; // Stop on other errors
                            } else {
                                const error = new Error('Unexpected response from bridge');
                                logError(error, 'Bridge registration error');

                                if (errorCallback) {
                                    errorCallback(error);
                                }

                                return GLib.SOURCE_REMOVE;
                            }

                            // If not successful, and still within retry limit:
                            attemptCount++;
                            if (attemptCount < maxAttempts) {
                                GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, retryInterval, tryRegister);
                            } else {
                                const error = new Error('Bridge registration timed out.');
                                logError(error, 'Hue bridge registration timeout');

                                if (errorCallback) {
                                    errorCallback(error);
                                }
                            }

                        } catch (e) {
                            logError(e, 'Failed to register with Hue bridge');
                            if (errorCallback)
                                errorCallback(e);
                        }

                        return GLib.SOURCE_REMOVE; // Prevent duplicate retry from this call
                    }
                );
            };
            // Start first attempt
            tryRegister();
        }

        _toggleRoomLight(groupId, turnOn) {
            const session = Soup.Session.new();

            const bridgeIP = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);
            const username = this._settings.get_string(this._settingsKey.HUE_USERNAME);
            const url = `http://${bridgeIP}/api/${username}/groups/${groupId}/action`;

            const body = JSON.stringify({on: turnOn});
            const bytes = new GLib.Bytes(new TextEncoder().encode(body));

            const message = Soup.Message.new("PUT", url);
            message.set_request_body_from_bytes('application/json', bytes);

            session.send_and_read_async(
                message,
                0,
                null,
                (source, result) => {
                    try {
                        const stream = session.send_and_read_finish(result);
                        const data = stream.get_data();
                        const text = new TextDecoder().decode(data);

                        if (message.get_status() !== Soup.Status.OK) {
                            throw new Error(`Hue request failed: ${message.get_status()}`);
                        }

                        const response = JSON.parse(text);

                        // Success response is usually: [{ "success": { "/groups/1/action/on": true }}]
                        if (Array.isArray(response) && response[0]?.success) {
                            log(`Successfully turned ${turnOn ? 'on' : 'off'} room ${groupId}`);
                        } else {
                            log(`Unexpected Hue response: ${text}`);
                        }

                    } catch (e) {
                        logError(e, `Failed to toggle light for room ${groupId}`);
                    }
                }
            );
        }

        _onConnectToHub() {
            const hubIPAddr = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);

            if (hubIPAddr !== '') {
                const dialog = new Adw.AlertDialog({
                    heading: "Hub Connection",
                    body: `Press the button on the Hub (${hubIPAddr})`
                });

                dialog.add_response("cancel", "Cancel");
                dialog.add_response("connect", "Connect");
                dialog.set_default_response("connect");
                dialog.set_response_enabled("connect", true);

                dialog.connect("response", (dlg, response) => {
                    if (response === "connect") {
                        // Perform connect logic here
                        this._registerWithBridge(
                            username => {

                                const successDialog = new Adw.AlertDialog({
                                    heading: "Hub Connection Succeeded",
                                    body: "Connection succeeded!"
                                });

                                successDialog.add_response("ok", "Ok");
                                successDialog.present(this.get_root());

                            },
                            error => {

                                log(`error ${error}`);
                                const errorDialog = new Adw.AlertDialog({
                                    heading: "Hub Connection Failed",
                                    body: `${error}`
                                });

                                errorDialog.add_response("ok", "Ok");
                                errorDialog.present(this.get_root());
                            }
                        );
                    }
                });

                dialog.present(this.get_root());
            } else {
                const dialog = new Adw.AlertDialog({
                    heading: "Hub Connection",
                    body: "Failed to fetch bridge info"
                });

                dialog.add_response("ok", "Ok");
                dialog.set_response_enabled("Ok", true);
                dialog.present(this.get_root());
            }
        }
    },
);
