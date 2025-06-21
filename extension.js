import GObject from 'gi://GObject';
import {PopupMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
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

        this._settings = Me._settings;

        // Get name of current default room
        const defaultRoomName = this._settings.get_string(SettingsKey.DEFAULT_ROOM_NAME);

        super._init({
            title: _('Hue Lights'),
            subtitle: _(`${defaultRoomName}`),
            iconName: 'lightbulb-symbolic',
            toggleMode: true,
        });
        
        // Set up entry
        // TODO make first null value the image
        this.menu.setHeader(null, _('Hue Lights'), null);

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
            }
        });

        // Ensure the settings are unavailable when the screen is locked
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[Me.uuid] = settingsItem;

        // Default behaviour of the menu item toggle
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

    destroy() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());

        this._settings = null;
        super.destroy();
    }
});

export default class HueExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new HueIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        // TODO: limit this to be only if we're in the home network with the bridge
        // On quickSettings open, align toggle with actual light state (e.g. if the light is on, so is the toggle)
        Main.panel.statusArea.quickSettings.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                (async () => {
                    try {
                        // Get name of current default room
                        const defaultRoomName = this._settings.get_string(SettingsKey.DEFAULT_ROOM_NAME);

                        this._indicator.quickSettingsItems[0].checked = await defaultLightIsOn(this._settings);

                        // Set subtitle to be the current room
                        this._indicator.quickSettingsItems[0].subtitle = defaultRoomName;
                    } catch (error) {
                        logError(error, 'Failed to check default light status');
                    }
                })();
            }
        });
    }

    disable() {
        this._indicator.destroy();
    }

     _openPreferences() {
        this.openPreferences();
        // QuickSettingsMenu.menu.close(PopupAnimation.FADE);
    }
}
