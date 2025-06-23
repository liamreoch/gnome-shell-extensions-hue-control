/* exported ResetPage */
"use strict";

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import {gettext as _} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export var ResetPage = GObject.registerClass(
    class HueResetPage extends Adw.PreferencesPage {
        _init(settings, settingsKey) {
            super._init({
                title: _("Reset"),
                icon_name: "reset-symbolic",
                name: "ResetPage",
            });
            this._settings = settings;
            this._settingsKey = settingsKey;

            let deleteHubConnectionGroup = new Adw.PreferencesGroup({
                title: _("Hub Connection"),
            });

            // Create Connect button
            let deleteButton = new Gtk.Button({
                child: new Adw.ButtonContent({
                    icon_name: 'list-add-symbolic',
                    label: _('Delete Hub Connection'),
                })
            });

            // Bind signal
            deleteButton.connect('clicked', this._onDeleteHubConnection.bind(this));


            // Add button to hubConnectionGroup
            deleteHubConnectionGroup.add(deleteButton);

            this.add(deleteHubConnectionGroup);

        }

        _onDeleteHubConnection() {
            // this._settings.get_string(this._settingsKey.HUB_NETWORK_ADDRESS);

            const dialog = new Adw.AlertDialog({
                heading: _('Delete Hub Connection'),
                body: _('Are you sure you want to delete this Hub Connection?'),
            });

            dialog.add_response("cancel", _('Cancel'));
            dialog.add_response("delete", _('Delete Hub Connection'));
            dialog.set_default_response("delete");
            dialog.set_response_enabled("delete", true);

            dialog.connect("response", (dlg, response) => {
                if (response === "delete") {
                    // Delete all data related to this connection
                    this._settings.set_string(this._settingsKey.HUB_NETWORK_ADDRESS, '');
                    this._settings.set_int(this._settingsKey.DEFAULT_ROOM_ID, 0);
                    this._settings.set_string(this._settingsKey.HUE_USERNAME, '');
                    this._settings.set_string(this._settingsKey.DEFAULT_ROOM_NAME, '');
                }
            });

            dialog.present(this.get_root());
        }
    });