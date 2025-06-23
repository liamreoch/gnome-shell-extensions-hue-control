import GObject from 'gi://GObject';
import {PopupMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {defaultLightIsOn, toggleLights} from './utils/toggleDefaultRoom.js';
import {SettingsKey} from './utils/settingsKeys.js';

import Gio from 'gi://Gio';
import St from 'gi://St';

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
        const toggle = new HueLightsToggle(Me);
        this.quickSettingsItems.push(toggle);
    }

    destroy() {
        this._indicator.quickSettingsItems.forEach(item => item.destroy());
        this._settings = null;
        super.destroy();
    }
});

export default class HueLightsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new HueLightsIndicator(this);
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

                        // Set the icon to match the state of the light
                        this._indicator.quickSettingsItems[0].updateIcon();

                        // Set subtitle to be the current room (if one exists)
                        if (defaultRoomName !== '') {
                            this._indicator.quickSettingsItems[0].subtitle = defaultRoomName;
                        }
                    } catch (error) {
                        logError(error, _('Failed to check default light status'));
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
