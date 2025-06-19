import GObject from 'gi://GObject';
import { PopupMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { QuickMenuToggle, SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';

import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';


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

        // Toggle checked state when clicked
        this.connect('clicked', () => {
            this.checked = !this.checked;
            log(`Hue toggle is now ${this.checked ? 'ON' : 'OFF'}`);
            // TODO: Add actual light control logic here
        });
    }
});


const HueIndicator = GObject.registerClass(
class HueIndicator extends QuickSettings.SystemIndicator {
    _init(Me) {
        super._init();

        this._indicator = this._addIndicator();
        this._indicator.iconName = 'lightbulb-symbolic';

        const toggle = new HueToggle(Me);
        toggle.bind_property('checked',
            this._indicator, 'visible',
            GObject.BindingFlags.SYNC_CREATE);

        this.quickSettingsItems.push(toggle);
    }
});

export default class HueExtension extends Extension {
    enable() {
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
