import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {defaultLightIsOn, toggleLights} from './utils/toggleDefaultRoom.js';
import {isBridgeAvailable} from "./utils/networkTools.js";
import {SettingsKey} from './utils/settingsKeys.js';
const QuickSettingsMenu = Main.panel.statusArea.quickSettings;
import { PopupAnimation } from 'resource:///org/gnome/shell/ui/boxpointer.js';
import {abortSession} from "./utils/session.js";


// Icons
const ActionsPath = '/icons/hicolor/scalable/actions/';
const DisabledIcon = 'lightbulb-off-symbolic';
const EnabledIcon = 'lightbulb-on-symbolic';

const HueLightsToggle = GObject.registerClass({
    Signals: {
        // No signals yet
    }
}, class HueLightsToggle extends QuickSettings.QuickMenuToggle {
    _init(Me) {

        this._settings = Me._settings;
        this._path = Me.path;

        // Get name of current default room
        const defaultRoomName = this._settings.get_string(SettingsKey.DEFAULT_ROOM_NAME);

        // Fallback if the user hasn't set a room yet
        const subtitle = defaultRoomName === '' ? _('No room selected') :  defaultRoomName;

        super._init({
            title: _('Hue Lights'),
            subtitle: subtitle,
            toggleMode: true,
        });

        // Icons
        this._iconActivated = Gio.ThemedIcon.new(EnabledIcon);
        this._iconDeactivated = Gio.ThemedIcon.new(DisabledIcon);
        this._iconTheme = new St.IconTheme();
        if (!this._iconTheme.has_icon(EnabledIcon)) {
            this._iconActivated = Gio.icon_new_for_string(`${this._path}${ActionsPath}${EnabledIcon}.svg`);
        }

        if (!this._iconTheme.has_icon(DisabledIcon)) {
            this._iconDeactivated = Gio.icon_new_for_string(`${this._path}${ActionsPath}${DisabledIcon}.svg`);
        }
        this.updateIcon();
        
        // Set up entry
        this.menu.setHeader(this._iconActivated, _('Hue Lights'), null);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings entry
        const settingsItem = this.menu.addAction(_('Settings'), () => {
            Me._openPreferences()
        });

        // Update name just in time
        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                currentRoom.label.text = this._settings.get_string(SettingsKey.DEFAULT_ROOM_NAME);

                // Check if the bridge is available and halt if not
                (async () => {
                    try {

                        const bridgeIP = this._settings.get_string(SettingsKey.HUB_NETWORK_ADDRESS);
                        const toggle = this._indicator.quickSettingsItems[0];

                        const bridgeAvailable = await isBridgeAvailable(bridgeIP);

                        // Early return if the bridge isn't accessible
                        if (!bridgeAvailable) {
                            return;
                        }

                        // Toggle the button if the light is on
                        toggle.checked = await defaultLightIsOn(this._settings);

                        // Set the icon to match the state of the light
                        toggle.updateIcon();

                    } catch (error) {
                        console.error(error, _('Failed to check default light status'));
                    }
                })();

            }
        });

        // Ensure the settings are unavailable when the screen is locked
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[Me.uuid] = settingsItem;

        // Default behaviour of the menu item toggle
        this.connect('clicked', () => {
            toggleLights(this._settings);
            this.updateIcon();
        });

        this.connect('destroy', () => {
            this._iconActivated = null;
            this._iconDeactivated = null;
            this.gicon = null;
        });
    }

    updateIcon() {
        if (this.checked) {
            this.gicon = this._iconActivated;
        } else {
            this.gicon = this._iconDeactivated;
        }
    }
});


const HueLightsIndicator = GObject.registerClass(
class HueLightsIndicator extends QuickSettings.SystemIndicator {
    _init(Me) {
        super._init();
        this._toggle = new HueLightsToggle(Me);
        this.quickSettingsItems.push(this._toggle);
    }

    destroy() {
        if (this._indicator) {
            this._indicator.quickSettingsItems.forEach(item => item.destroy());
        }
        this._settings = null;
        this._toggle.destroy();
        super.destroy();
    }
});

export default class HueLightsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new HueLightsIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        // On quickSettings open, align toggle with actual light state (e.g. if the light is on, so is the toggle)
        Main.panel.statusArea.quickSettings.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                (async () => {
                    try {

                        const bridgeIP = this._settings.get_string(SettingsKey.HUB_NETWORK_ADDRESS);
                        const toggle = this._indicator.quickSettingsItems[0];

                        const bridgeAvailable = await isBridgeAvailable(bridgeIP);

                        // Early return if the bridge isn't accessible
                        if (!bridgeAvailable) {
                            toggle.checked = false;
                            toggle.subtitle = _('No bridge found');

                            // Update icon to reflect disabled state
                            toggle.updateIcon();
                            return;
                        }

                        // Get name of current default room
                        const defaultRoomName = this._settings.get_string(SettingsKey.DEFAULT_ROOM_NAME);
                        toggle.checked = await defaultLightIsOn(this._settings);

                        // Set the icon to match the state of the light
                        toggle.updateIcon();

                        // Set subtitle to be the current room (if one exists)
                        if (defaultRoomName !== '') {
                            toggle.subtitle = defaultRoomName;
                        }
                    } catch (error) {
                        console.error(error, _('Failed to check default light status'));
                    }
                })();
            }
        });
    }

    disable() {
        this._settings = null;

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        abortSession();
    }

     _openPreferences() {
        this.openPreferences();
        QuickSettingsMenu.menu.close(PopupAnimation.FADE);
    }
}
