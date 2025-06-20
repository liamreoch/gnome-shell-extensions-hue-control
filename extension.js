import GObject from 'gi://GObject';
import { PopupMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { QuickMenuToggle, SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';

import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { toggleLights } from './utils/toggleDefaultRoom.js';
import {SettingsKey as settingsKey} from './utils/settingsKeys.js';

// import Main from 'resource:///org/gnome/shell/ui/main.js';

import Adw from "gi://Adw";


const HueToggle = GObject.registerClass({
    Signals: {
        // No signals yet
    }
}, class HueToggle extends QuickSettings.QuickMenuToggle {
    _init(Me) {

        super._init({
            title: _('Hue Lights'),
            iconName: 'lightbulb-symbolic',
            toggleMode: true,
        });

        this._settings = Me._settings;

        // Add a simple non-reactive menu item as a placeholder
        const placeholderItem = new PopupMenuItem(_('Lights will go here'), {
            reactive: false,
            can_focus: false,
        });
        this.menu.addMenuItem(placeholderItem);

        const settingsItem = this.menu.addAction(_('Settings'), () => Me._openPreferences());

        // Ensure the settings are unavailable when the screen is locked
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[Me.uuid] = settingsItem;

        this.connect('clicked', () => {
            log(`Hue toggle is now ${this.checked ? 'ON' : 'OFF'}`);
            // TODO: Add actual light control logic here

            // TODO: Check if lights are on already and toggle switch if so
            // call to bridge, if on, this.checked = true, else false

            // const settings = this.getSettings();

            const bridgeIP = this._settings.get_string(settingsKey.HUB_NETWORK_ADDRESS);
            const username = this._settings.get_string(settingsKey.HUE_USERNAME);
            const groupId = this._settings.get_int(settingsKey.DEFAULT_ROOM_ID);

            log(`The default groupID is ${groupId}`);
            //
            // const dialog = new Adw.AlertDialog({
            //     heading: "Hub Connection",
            //     body: `The default groupID is ${groupId}`
            // });
            //
            // dialog.add_response("cancel","Cancel");
            // dialog.set_default_response("cancel");
            // dialog.present(this.get_root());

            log(`Current groupID is ${groupId}, Current username is ${username},  Current bridgeIP is ${bridgeIP}`);


            toggleLights(this._settings);
        });


    }
});


const HueIndicator = GObject.registerClass(
class HueIndicator extends QuickSettings.SystemIndicator {
    _init(Me) {
        super._init();

        // this._indicator = this._addIndicator();
        // this._indicator.iconName = 'lightbulb-symbolic';

        const toggle = new HueToggle(Me);
        // toggle.bind_property('checked',
        //     this._indicator, 'visible',
        //     GObject.BindingFlags.SYNC_CREATE);

        this.quickSettingsItems.push(toggle);
    }
});

export default class HueExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new HueIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
    }

     _openPreferences() {
        this.openPreferences();
        // QuickSettingsMenu.menu.close(PopupAnimation.FADE);
    }
}
