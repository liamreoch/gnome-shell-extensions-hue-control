import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {PopupMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {defaultLightIsOn, toggleLights} from './utils/toggleDefaultRoom.js';
import {SettingsKey} from './utils/settingsKeys.js';

// Icons
const ActionsPath = '/icons/hicolor/scalable/actions/';
const DisabledIcon = 'light-bulb';

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

        // Set up entry
        // TODO make first null value the image
        this.menu.setHeader(null, _('Hue Lights'), null);

        // Get name of current default room
        const defaultRoomName = this._settings.get_string(SettingsKey.DEFAULT_ROOM_NAME);

        // Add a simple non-reactive menu item as a placeholder
        const currentRoom = new PopupMenuItem(_(`${defaultRoomName}`), {
            reactive: false,
            can_focus: false,
        });

        this.menu.addMenuItem(currentRoom);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Settings
        const settingsItem = this.menu.addAction(_('Settings'), () => {
            Me._openPreferences()
        });

        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                currentRoom.label.text = this._settings.get_string(SettingsKey.DEFAULT_ROOM_NAME);
            }
        });

        // Ensure the settings are unavailable when the screen is locked
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[Me.uuid] = settingsItem;

        this.connect('clicked', () => {
            toggleLights(this._settings);
        });
    }
});


const HueIndicator = GObject.registerClass(
class HueIndicator extends QuickSettings.SystemIndicator {
    _init(Me) {
        super._init();
        const toggle = new HueToggle(Me);
        this.quickSettingsItems.push(toggle);
    }
});

export default class HueExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new HueIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        // On menu open, turn toggle on
        // TODO: limit this to be only if we're in the home network with the bridge
        Main.panel.statusArea.quickSettings.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                (async () => {
                    try {
                        this._indicator.quickSettingsItems[0].checked = await defaultLightIsOn(this._settings);
                    } catch (e) {
                        logError(e, 'Failed to check default light status');
                    }
                })();
            }
        });

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
