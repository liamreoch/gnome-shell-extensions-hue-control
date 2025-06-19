"use strict";

import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";

import * as GeneralPrefs from "./preferences/generalPage.js";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

const SettingsKey = {

  // TOGGLE_SHORTCUT: "toggle-shortcut",
  DEFAULT_WIDTH: "prefs-default-width",
  DEFAULT_HEIGHT: "prefs-default-height",
  DEFAULT_ROOM_ID: "default-room-id",
  HUB_NETWORK_ADDRESS: "hub-network-address",
  HUE_USERNAME: "hue-username"
};

export default class PhilipsHuePrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    // let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    // if (!iconTheme.get_search_path().includes(this.path + '/icons')) {
    //    iconTheme.add_search_path(this.path + '/icons');
    // }

    const settings = this.getSettings();
    const generalPage = new GeneralPrefs.GeneralPage(settings, SettingsKey);

    let prefsWidth = settings.get_int(SettingsKey.DEFAULT_WIDTH);
    let prefsHeight = settings.get_int(SettingsKey.DEFAULT_HEIGHT);
    window.set_default_size(prefsWidth, prefsHeight);
    window.set_search_enabled(true);

    window.add(generalPage);

    window.connect("close-request", () => {
      let currentWidth = window.default_width;
      let currentHeight = window.default_height;
      // Remember user window size adjustments.
      if (currentWidth !== prefsWidth || currentHeight !== prefsHeight) {
        settings.set_int(SettingsKey.DEFAULT_WIDTH, currentWidth);
        settings.set_int(SettingsKey.DEFAULT_HEIGHT, currentHeight);
      }
      window.destroy();
    });
  }
}
