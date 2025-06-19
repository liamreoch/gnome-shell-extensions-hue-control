/* exported GeneralPage */
"use strict";

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

// TODO: Maybe move this elsewhere
const session = new Soup.Session();
// let sessionSync = new Soup.SessionSync();



import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

const genParam = (type, name, ...dflt) =>
  GObject.ParamSpec[type](
    name,
    name,
    name,
    GObject.ParamFlags.READWRITE,
    ...dflt,
  );

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

      // If there's no current Hub IP address in the schema key, get it
      const hubIPAddr = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);

      log(`Hub address in schema: ${hubIPAddr}`);

      if (hubIPAddr == '') {
        this._fetchBridgeInfo();
      }


      // TEMP GET username
      const hue_username = this._settings.get_string(this._settingsKey.HUE_USERNAME);

      log(`hue username: ${hue_username}`);

      // Hub Connection group
      // --------------
      let hubConnectionGroup = new Adw.PreferencesGroup({
        title: _("Hub Connection"),
      });

      // Create Connect button
      let connectButton = new Gtk.Button({
        child: new Adw.ButtonContent({
            icon_name: 'list-add-symbolic',
            label: _('Connect')
        })
      });


      // Bind signals
      connectButton.connect('clicked', this._onConnectToHub.bind(this));

      // Add button to hubConnectionGroup
      hubConnectionGroup.add(connectButton);

      this.add(hubConnectionGroup);


      let rooms = [];

      // Default room Group
      let defaultRoomGroup = new Adw.PreferencesGroup({
        title: _("Default room"),
      });

      // StringList for room names
      let roomStore = new Gtk.StringList();


      // Rooms group
      // --------------
      let roomsGroup = new Adw.PreferencesGroup({
        title: _("Rooms"),
      });

      this._getHueRooms(rooms => {
          if (rooms.length != 0) {
            // This happens after it returns, so we can nest the dependent code here


            // Populate roomStore
            for (const room of rooms) {
              let item = Gtk.StringObject
              roomStore.append(_(room.name));
            }

            // Temporary dummy value for defaultRoomId
            let defaultRoomId = 3

            // Find current default room index
            const currentIndex = rooms.findIndex((r) => r.id === defaultRoomId);
            const defaultIndex = currentIndex >= 0 ? currentIndex : 0;

            // ComboRow for room affected by switch
            let defaultRoomRow = new Adw.ComboRow({
              title: _('Default Room'),
              subtitle: _('The room that responds to the menu light toggle'),
              model: roomStore,
              selected: this._settings.get_int(this._settingsKey.DEFAULT_ROOM_ID)
            });


            // Handle change
            defaultRoomRow.connect("notify::selected", () => {
              const index = comboRow.selected;
              const selectedRoom = rooms[index];
              settings.set_string("default-room-id", selectedRoom.id);
              console.log(`Default room set to ${selectedRoom.name}`);
            });

            defaultRoomGroup.add(defaultRoomRow);

            // Add selection row to main windows
            this.add(defaultRoomGroup);


            for (const room of rooms) {
              const row = new Adw.SwitchRow({
                title: room.name,
                active: room.state.any_on,
              });

              row.id = room.id;

              row.connect('notify::active', (sw) => {
                  if (sw.active) {
                      log(`Activated room: ${sw.title} (ID: ${row.id})`);
                      this._toggleRoomLight(row.id, true);

                  } else {
                      log(`Deactivated room: ${sw.title} (ID: ${row.id})`);
                      this._toggleRoomLight(row.id, false);
                  }
              });

              roomsGroup.add(row);
            }

            this.add(roomsGroup);


          }
      }, error => {
          log(`Could not get rooms: ${error.message}`);
      });

    }

    _fetchBridgeInfo() {
      const url ="https://discovery.meethue.com/";

      const session = new Soup.Session();
      const message = Soup.Message.new('GET', url);

      session.send_and_read_async(
        message,
        // GLib.PRIORITY_DEFAULT,
        0,
        null,
        (source, result) => {
            try {
                const stream = session.send_and_read_finish(result);
                const bytes = stream.get_data();
                const text = new TextDecoder().decode(bytes);

                log(`Status Code: ${message.get_status()}`);
                log(`Body:\n${text}`);

                if (message.get_status() !== Soup.Status.OK) {
                    throw new Error(`Request failed with status ${message.get_status()}`);
                }

                let data = JSON.parse(text);

                if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== 'object') {
                    throw new Error('Expected a non-empty array of JSON objects');
                }

                let hubInfo = data[0];

                log('Setting Schema key');

                // Update key value in schema
                this._settings.set_string(this._settingsKey.HUB_NETWORK_ADDRESS, hubInfo.internalipaddress);

            } catch (error) {
                logError(error, "Failed to fetch bridge info");
            }
        }
    );
    }



    _getHueRooms(callback, errorCallback = null) {
      const Soup = imports.gi.Soup;
      const GLib = imports.gi.GLib;

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
    const Soup = imports.gi.Soup;
    const GLib = imports.gi.GLib;

    const session = new Soup.Session();
    const bridgeIPAddr = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);
    const url = `http://${bridgeIPAddr}/api`;
    const body = JSON.stringify({ devicetype: "gnome_hue_extension#fedora" });
    const bytes = new GLib.Bytes(new TextEncoder().encode(body));

    let attemptCount = 0;
    const maxAttempts = 15;
    const retryInterval = 2; // seconds

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

                    log(`Status Code: ${message.get_status()}`);
                    log(`Bridge Response:\n${text}`);

                    if (message.get_status() !== Soup.Status.OK) {
                        throw new Error(`POST failed with status ${message.get_status()}`);
                    }

                    const data = JSON.parse(text);

                    if (Array.isArray(data) && data[0].success) {
                        const username = data[0].success.username;

                        log(`Bridge registration succeeded: ${username}`);

                        // Save in schema
                        this._settings.set_string(this._settingsKey.HUE_USERNAME, username);
                        log(`Hue username stored: ${username}`);

                        if (successCallback) {
                          successCallback(username);
                        }


                        return GLib.SOURCE_REMOVE; // Stop retrying
                    } else if (data[0]?.error?.type === 101) {
                        // Link button not pressed yet, keep retrying
                        log(`Link button not pressed. Attempt ${attemptCount + 1}/${maxAttempts}`);
                    } else if (data[0]?.error) {
                        const error = new Error(data[0].error.description);
                        logError(error, 'Bridge registration error');

                        if (errorCallback)
                            errorCallback(error);

                        return GLib.SOURCE_REMOVE; // Stop on other errors
                    } else {
                        const error = new Error('Unexpected response from bridge');
                        logError(error, 'Bridge registration error');

                        if (errorCallback)
                            errorCallback(error);

                        return GLib.SOURCE_REMOVE;
                    }

                    // If not successful, and still within retry limit:
                    attemptCount++;
                    if (attemptCount < maxAttempts) {
                        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, retryInterval, tryRegister);
                    } else {
                        const error = new Error('Bridge registration timed out.');
                        logError(error, 'Hue bridge registration timeout');

                        if (errorCallback)
                            errorCallback(error);
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

    tryRegister(); // Start first attempt
}

    _toggleRoomLight(groupId, turnOn) {
      // const Soup = imports.gi.Soup;
      // const GLib = imports.gi.GLib;

      const session = Soup.Session.new();

      const bridgeIP = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);
      const username = this._settings.get_string(this._settingsKey.HUE_USERNAME);
      const url = `http://${bridgeIP}/api/${username}/groups/${groupId}/action`;

      const body = JSON.stringify({ on: turnOn });
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


    _resetShortcut() {
      this.shortcutKeyBoard.resetAccelerator();
    }

    _onConnectToHub() {

      // Here we should send a request to identify the Hub IP

      log("Connect button clicked");
      const hubIPAddr = this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);

      if (hubIPAddr != '') {
        const dialog = new Adw.AlertDialog({
          heading: "Hub Connection",
          body: `Press the button on the Hub (${hubIPAddr})`
        });

        dialog.add_response("cancel","Cancel");
        dialog.add_response("connect","Connect");
        dialog.set_default_response("connect");
        dialog.set_response_enabled("connect", true);

        dialog.connect("response", (dlg, response) => {
              if (response === "connect") {
                  log("Connecting to hub...");
                  // Perform connect logic here
                  this._registerWithBridge(
                    username => {

                      const successDialog = new Adw.AlertDialog({
                        heading: "Hub Connection Succeeded",
                        body: `Connection succeeded. ${username}`
                      });

                      successDialog.add_response("ok","Ok");
                      successDialog.present(this.get_root());

                    },
                    error => {

                        log(`error ${error}`);
                        const errorDialog = new Adw.AlertDialog({
                          heading: "Hub Connection Failed",
                          body: `${error}`
                        });

                        errorDialog.add_response("ok","Ok");
                        errorDialog.present(this.get_root());
                    }
                );
              } else {
                  log("Cancelled");
              }
          });

        dialog.present(this.get_root());
      } else {
        const dialog = new Adw.AlertDialog({
          heading: "Hub Connection",
          body: "Failed to fetch bridge info"
        });

        dialog.add_response("ok","Ok");

        dialog.set_response_enabled("Ok", true);
        dialog.present(this.get_root());
      }
    }
  },


);
