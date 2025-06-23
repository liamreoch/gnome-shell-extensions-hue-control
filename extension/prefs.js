"use strict";

import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import * as GeneralPrefs from "./preferences/generalPage.js";
import * as ResetPrefs from "./preferences/resetPage.js";
import { SettingsKey } from './utils/settingsKeys.js';
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class HueLightsPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    if (!iconTheme.get_search_path().includes(this.path + '/icons')) {
       iconTheme.add_search_path(this.path + '/icons');
    }

    const settings = this.getSettings();
    const generalPage = new GeneralPrefs.GeneralPage(settings, SettingsKey);
    const resetPage = new ResetPrefs.ResetPage(settings, SettingsKey);

    let prefsWidth = settings.get_int(SettingsKey.DEFAULT_WIDTH);
    let prefsHeight = settings.get_int(SettingsKey.DEFAULT_HEIGHT);

    window.set_default_size(prefsWidth, prefsHeight);
    window.set_search_enabled(true);

    window.add(generalPage);
    window.add(resetPage);

    window.connect("close-request", () => {
      let currentWidth = window.default_width;
      let currentHeight = window.default_height;

      // Remember user window size adjustments.
      if (currentWidth !== prefsWidth || currentHeight !== prefsHeight) {
        settings.set_int(SettingsKey.DEFAULT_WIDTH, currentWidth);
        settings.set_int(SettingsKey.DEFAULT_HEIGHT, currentHeight);
      }

      // window.destroy();
      return false;
    });
  }
}
